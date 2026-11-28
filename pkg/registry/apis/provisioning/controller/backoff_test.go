package controller

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func TestBackoffDelay(t *testing.T) {
	base := time.Minute
	for failures, want := range map[int]time.Duration{
		1:  time.Minute,
		2:  2 * time.Minute,
		3:  4 * time.Minute,
		5:  16 * time.Minute,
		6:  30 * time.Minute,
		50: 30 * time.Minute,
	} {
		assert.Equal(t, want, backoffDelay(failures, base), "failures=%d", failures)
	}
	assert.Equal(t, 30*time.Minute, backoffDelay(1, time.Hour), "a base above the cap is capped")
	assert.Equal(t, 30*time.Minute, backoffDelay(1, 0), "a missing base falls back to the cap")
}

func TestJitterDuration(t *testing.T) {
	d := 5 * time.Minute
	lo, hi := d-time.Duration(syncJitterFraction*float64(d)), d+time.Duration(syncJitterFraction*float64(d))
	seen := map[time.Duration]bool{}
	for i := range 200 {
		seed := fmt.Sprintf("default/repo-%d", i)
		j := jitterDuration(d, seed)
		assert.GreaterOrEqual(t, j, lo)
		assert.LessOrEqual(t, j, hi)
		assert.Equal(t, j, jitterDuration(d, seed), "the same seed must give the same threshold")
		seen[j] = true
	}
	assert.Greater(t, len(seen), 150, "different repositories must spread out")
}

func TestUnhealthyBackoff(t *testing.T) {
	var b unhealthyBackoff
	now := time.Now()
	_, ok := b.active("ns/repo", now)
	assert.False(t, ok, "no backoff before any failure")

	first := b.recordFailure("ns/repo", time.Minute, now)
	assert.InDelta(t, float64(time.Minute), float64(first), syncJitterFraction*float64(time.Minute))
	until, ok := b.active("ns/repo", now)
	require.True(t, ok)
	assert.Equal(t, now.Add(first), until)
	_, ok = b.active("ns/repo", now.Add(first))
	assert.False(t, ok, "backoff expires after the delay")
	_, ok = b.active("ns/other", now)
	assert.False(t, ok, "backoff is per repository")

	second := b.recordFailure("ns/repo", time.Minute, now)
	assert.InDelta(t, float64(2*time.Minute), float64(second), syncJitterFraction*float64(2*time.Minute))

	var last time.Duration
	for range 10 {
		last = b.recordFailure("ns/repo", time.Minute, now)
	}
	assert.LessOrEqual(t, last, unhealthyBackoffCap+time.Duration(syncJitterFraction*float64(unhealthyBackoffCap)))
	assert.GreaterOrEqual(t, last, unhealthyBackoffCap-time.Duration(syncJitterFraction*float64(unhealthyBackoffCap)))

	b.reset("ns/repo")
	_, ok = b.active("ns/repo", now)
	assert.False(t, ok, "success clears the backoff")
	again := b.recordFailure("ns/repo", time.Minute, now)
	assert.InDelta(t, float64(time.Minute), float64(again), syncJitterFraction*float64(time.Minute), "backoff restarts from base after a reset")
}

func TestRepositoryController_shouldResync_Jitter(t *testing.T) {
	rc := &RepositoryController{}
	interval := 300 * time.Second
	checked := time.Now().Add(-interval).UnixMilli()
	due := 0
	for i := range 100 {
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: fmt.Sprintf("repo-%d", i)},
			Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Enabled: true, IntervalSeconds: int64(interval.Seconds())}},
			Status:     provisioning.RepositoryStatus{Sync: provisioning.SyncStatus{State: provisioning.JobStateSuccess, Finished: checked}},
		}
		if rc.shouldResync(t.Context(), obj) {
			due++
		}
		obj.Status.Sync.Finished = time.Now().Add(-interval - time.Duration(syncJitterFraction*float64(interval)) - time.Second).UnixMilli()
		assert.True(t, rc.shouldResync(t.Context(), obj), "every repository is due once the jitter window has passed")
		obj.Status.Sync.Finished = time.Now().Add(-interval + time.Duration(syncJitterFraction*float64(interval)) + time.Second).UnixMilli()
		assert.False(t, rc.shouldResync(t.Context(), obj), "no repository is due before the jitter window")
	}
	assert.Greater(t, due, 10, "some repositories are due at exactly the interval")
	assert.Less(t, due, 90, "not all repositories are due at exactly the interval")
}

func TestRepositoryController_process_BacksOffUnbuildableRepository(t *testing.T) {
	obj := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "repo", Namespace: "default", Generation: 1},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitRepositoryType,
			Sync: provisioning.SyncOptions{Enabled: true, IntervalSeconds: 60},
		},
		Status: provisioning.RepositoryStatus{
			ObservedGeneration: 1,
			Health:             provisioning.HealthStatus{Healthy: false, Error: provisioning.HealthFailureHealth, Checked: time.Now().Add(-time.Hour).UnixMilli()},
			Sync: provisioning.SyncStatus{
				State:    provisioning.JobStateError,
				Finished: time.Now().Add(-time.Hour).UnixMilli(),
			},
		},
	}
	indexer := cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc})
	require.NoError(t, indexer.Add(obj))
	getter := informer.NewCachedRepositoryGetter(listers.NewRepositoryLister(indexer))
	patcher := &capturePatcher{}
	factory := repository.NewMockFactory(t)
	factory.On("Build", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("decrypt token: %w", repository.ErrSecretDecryptFailed)).Once()
	rc := &RepositoryController{
		repos:         getter,
		quotaGetter:   quotas.NewFixedQuotaGetter(provisioning.QuotaStatus{}),
		quotaChecker:  NewRepositoryQuotaChecker(getter),
		healthChecker: NewRepositoryHealthChecker(patcher, repository.NewTester(), NewMockHealthMetricsRecorder(t)),
		statusPatcher: patcher,
		repoFactory:   factory,
		jobs:          &mockJobsQueueStore{MockQueue: jobs.NewMockQueue(t), MockStore: jobs.NewMockStore(t)},
		logger:        logging.DefaultLogger,
		tracer:        tracing.InitializeTracerForTest(),
	}

	_, err := rc.process("default/repo")
	require.ErrorIs(t, err, repository.ErrSecretDecryptFailed)
	_, ok := rc.unhealthyBackoff.active("default/repo", time.Now())
	require.True(t, ok, "a build failure starts the backoff")

	_, err = rc.process("default/repo")
	require.NoError(t, err)
	factory.AssertNumberOfCalls(t, "Build", 1)

	rc.unhealthyBackoff.entries["default/repo"] = backoffEntry{failures: 1, until: time.Now().Add(-time.Second)}
	factory.On("Build", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("decrypt token: %w", repository.ErrSecretDecryptFailed)).Once()
	_, err = rc.process("default/repo")
	require.ErrorIs(t, err, repository.ErrSecretDecryptFailed)
	factory.AssertNumberOfCalls(t, "Build", 2)
	assert.Equal(t, 2, rc.unhealthyBackoff.entries["default/repo"].failures, "consecutive failures keep doubling the backoff")

	rc.queue = workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]())
	defer rc.queue.ShutDown()
	rc.queue.AddRateLimited("default/repo")
	factory.On("Build", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("decrypt token: %w", repository.ErrSecretDecryptFailed)).Once()
	_, err = rc.process("default/repo")
	require.ErrorIs(t, err, repository.ErrSecretDecryptFailed)
	factory.AssertNumberOfCalls(t, "Build", 3)
}

func TestRepositoryController_process_HealthyResetsBackoff(t *testing.T) {
	rc, obj, repo, _, _ := newIntervalController(t, provisioning.JobStateSuccess)
	rc.unhealthyBackoff.entries = map[string]backoffEntry{"default/repo": {failures: 4, until: time.Now().Add(-time.Second)}}
	repo.MockVersioned.On("LatestRef", mock.Anything).Return(obj.Status.Sync.LastRef, nil).Once()

	_, err := rc.process("default/repo")
	require.NoError(t, err)
	_, found := rc.unhealthyBackoff.entries["default/repo"]
	assert.False(t, found, "a healthy check clears the backoff")
}
