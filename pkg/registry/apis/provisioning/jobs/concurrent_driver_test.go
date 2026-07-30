package jobs

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

func newTestConcurrentDriver(t *testing.T, numDrivers int, store Store, repoGetter RepoGetter, history HistoryWriter, metrics *JobMetrics, workers ...Worker) *ConcurrentJobDriver {
	t.Helper()
	driver, err := NewConcurrentJobDriver(
		numDrivers,
		time.Minute, 30*time.Second, 30*time.Second,
		store, repoGetter, history,
		prometheus.NewRegistry(),
		metrics,
		false, // natsBacked
		workers...,
	)
	require.NoError(t, err)
	return driver
}

// TestNewConcurrentJobDriver_RejectsBadConfig verifies that configuration that
// makes no sense (no workers) is rejected at construction time.
func TestNewConcurrentJobDriver_RejectsBadConfig(t *testing.T) {
	_, err := NewConcurrentJobDriver(
		0,
		time.Minute, 30*time.Second, 30*time.Second,
		&MockStore{}, &MockRepoGetter{}, &MockHistoryWriter{},
		prometheus.NewRegistry(), nil,
		false,
	)
	require.ErrorContains(t, err, "numDrivers")
}

// TestConcurrentJobDriver_EventHandler_Enqueue verifies which informer add
// events feed the work queue: minimal (NATS-style) objects and unclaimed full
// objects enqueue, while full objects that already carry a claim are skipped.
func TestConcurrentJobDriver_EventHandler_Enqueue(t *testing.T) {
	driver := newTestConcurrentDriver(t, 1, &MockStore{}, &MockRepoGetter{}, &MockHistoryWriter{}, nil)
	handler := driver.EventHandler()

	// A claimed full object (apiserver informer initial list) is skipped.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "ns1",
			Name:      "claimed-job",
			Labels:    map[string]string{LabelJobClaim: "1000000000000"},
		},
	}, false)
	assert.Equal(t, 0, driver.queue.Len(), "claimed jobs must not enqueue")

	// A minimal object (NATS live event: namespace+name only) enqueues.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "new-job"},
	}, false)
	assert.Equal(t, 1, driver.queue.Len())

	// Duplicate adds of the same key coalesce while queued.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "new-job"},
	}, false)
	assert.Equal(t, 1, driver.queue.Len(), "the queue must deduplicate keys")
}

// TestConcurrentJobDriver_EventHandler_UpdateEnqueue verifies the resync
// recovery path: a re-list/resync delivers known jobs as updates, and only
// full unclaimed objects re-enter the queue. Claimed jobs (running work) and
// minimal NATS live updates (claim/lease/progress churn) are skipped.
func TestConcurrentJobDriver_EventHandler_UpdateEnqueue(t *testing.T) {
	driver := newTestConcurrentDriver(t, 1, &MockStore{}, &MockRepoGetter{}, &MockHistoryWriter{}, nil)
	handler := driver.EventHandler()

	// A minimal object (NATS live MODIFIED: namespace+name only) is churn from
	// a running job and must not enqueue.
	minimal := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "running-job"},
	}
	handler.UpdateFunc(minimal, minimal)
	assert.Equal(t, 0, driver.queue.Len(), "minimal live updates must not enqueue")

	// A full object that carries a claim is a running job.
	claimed := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:       "ns1",
			Name:            "claimed-job",
			ResourceVersion: "42",
			Labels:          map[string]string{LabelJobClaim: "1000000000000"},
		},
	}
	handler.UpdateFunc(claimed, claimed)
	assert.Equal(t, 0, driver.queue.Len(), "claimed jobs must not enqueue")

	// A live watch update that removes the claim (a rollback after a
	// post-claim failure) carries a bumped resource version and must not
	// enqueue: the job's side effects may already have run, and the queue would
	// redeliver the in-flight key immediately. The next resync recovers it.
	rolledBack := claimed.DeepCopy()
	rolledBack.ResourceVersion = "43"
	rolledBack.Labels = nil
	handler.UpdateFunc(claimed, rolledBack)
	assert.Equal(t, 0, driver.queue.Len(), "live rollback updates must not enqueue")

	// A resync/re-list redelivery hands the same stored object as old and new;
	// an unclaimed one enqueues: this recovers rolled-back claims and
	// previously dropped keys at the resync cadence.
	unclaimed := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "pending-job", ResourceVersion: "43"},
	}
	handler.UpdateFunc(unclaimed, unclaimed)
	assert.Equal(t, 1, driver.queue.Len(), "full unclaimed resync updates must enqueue")

	// Repeated resync deliveries of the same key coalesce while queued.
	handler.UpdateFunc(unclaimed, unclaimed)
	assert.Equal(t, 1, driver.queue.Len(), "the queue must deduplicate keys")
}

// TestConcurrentJobDriver_ClaimedElsewhereIsDropped verifies that a key whose
// job is already claimed by another worker is dropped without retries.
func TestConcurrentJobDriver_ClaimedElsewhereIsDropped(t *testing.T) {
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "ns1", "job1", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
	}, false)

	require.Eventually(t, func() bool { return claims.Load() == 1 }, 2*time.Second, 10*time.Millisecond)

	// The key must be forgotten, not retried.
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(1), claims.Load(), "an already-claimed job must not be retried")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_TransientErrorsRetryUntilDropped verifies that
// transient claim failures are retried with rate limiting up to
// maxClaimAttempts, and then the key is dropped (the informer re-list re-adds
// it if the job is still unclaimed).
func TestConcurrentJobDriver_TransientErrorsRetryUntilDropped(t *testing.T) {
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "ns1", "job1", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, errors.New("transient API error")
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
	}, false)

	require.Eventually(t, func() bool { return claims.Load() == maxClaimAttempts }, 2*time.Second, 10*time.Millisecond)

	// After the attempts are exhausted the key must be dropped.
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(maxClaimAttempts), claims.Load(), "the key must be dropped after maxClaimAttempts")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_ResyncUpdateRecoversDroppedJob verifies the recovery
// path end to end: a job whose key is not in the queue (dropped, rolled back,
// or its create event missed) is picked up again when a resync/re-list
// delivers it as a full unclaimed update.
func TestConcurrentJobDriver_ResyncUpdateRecoversDroppedJob(t *testing.T) {
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "ns1", "pending-job", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	// A resync delivers the still-unclaimed job as a full-object update.
	pending := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "pending-job", ResourceVersion: "7"},
	}
	driver.EventHandler().UpdateFunc(pending, pending)

	require.Eventually(t, func() bool { return claims.Load() == 1 }, 2*time.Second, 10*time.Millisecond,
		"a resync update for an unclaimed job must reach a worker")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_ProcessesJobEndToEnd drives one job from an informer
// event through claim, processing, history write and completion.
func TestConcurrentJobDriver_ProcessesJobEndToEnd(t *testing.T) {
	claimedJob := makeTestJob("1")
	claimedJob.Labels = map[string]string{
		LabelJobClaim:      "1000000000000",
		LabelJobClaimOwner: "owner-A",
	}

	var rollbackCalled atomic.Bool
	completed := make(chan struct{})

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job", "0").
		Return(claimedJob, func() { rollbackCalled.Store(true) }, nil).Once()
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
			return job.DeepCopy(), nil
		}).Maybe()
	store.EXPECT().Get(mock.Anything, mock.Anything, mock.Anything).Return(claimedJob.DeepCopy(), nil).Maybe()
	store.EXPECT().RenewLease(mock.Anything, mock.Anything).Return(nil).Maybe()
	store.EXPECT().Complete(mock.Anything, mock.Anything).
		RunAndReturn(func(context.Context, *provisioning.Job) error {
			close(completed)
			return nil
		}).Once()

	history := &MockHistoryWriter{}
	history.EXPECT().WriteJob(mock.Anything, mock.Anything).Return(nil).Once()

	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(makeRepoConfig("test-repo", nil, nil))

	repoGetter := &MockRepoGetter{}
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").Return(mockRepo, nil)

	worker := &MockWorker{}
	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(nil)

	metrics := RegisterJobMetrics(prometheus.NewPedanticRegistry())
	driver := newTestConcurrentDriver(t, 1, store, repoGetter, history, &metrics, worker)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	// A NATS-style minimal add event carries only the key.
	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
	}, false)

	select {
	case <-completed:
	case <-time.After(5 * time.Second):
		t.Fatal("job was not completed")
	}

	cancel()
	require.NoError(t, <-runDone)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, mock.Anything)
	history.AssertCalled(t, "WriteJob", mock.Anything, mock.Anything)
	assert.True(t, rollbackCalled.Load(), "the deferred rollback must always run; the store makes it a no-op for completed jobs")
}

// TestConcurrentJobDriver_PostClaimFailureDoesNotRerunJob verifies that a
// failure after the job was claimed and executed (here: Complete fails) does
// not rate-limit-retry the key. The claim rollback returns the job to pending,
// so an immediate retry would re-claim it and re-run the worker's side effects;
// recovery belongs to the informer re-list instead.
func TestConcurrentJobDriver_PostClaimFailureDoesNotRerunJob(t *testing.T) {
	claimedJob := makeTestJob("1")
	claimedJob.Labels = map[string]string{
		LabelJobClaim:      "1000000000000",
		LabelJobClaimOwner: "owner-A",
	}

	var claims atomic.Int32
	completeCalled := make(chan struct{})

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return claimedJob.DeepCopy(), func() {}, nil
		}).Maybe()
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
			return job.DeepCopy(), nil
		}).Maybe()
	store.EXPECT().Get(mock.Anything, mock.Anything, mock.Anything).Return(claimedJob.DeepCopy(), nil).Maybe()
	store.EXPECT().RenewLease(mock.Anything, mock.Anything).Return(nil).Maybe()
	store.EXPECT().Complete(mock.Anything, mock.Anything).
		RunAndReturn(func(context.Context, *provisioning.Job) error {
			select {
			case <-completeCalled:
			default:
				close(completeCalled)
			}
			return errors.New("transient delete failure")
		}).Maybe()

	history := &MockHistoryWriter{}
	history.EXPECT().WriteJob(mock.Anything, mock.Anything).Return(nil).Maybe()

	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(makeRepoConfig("test-repo", nil, nil))

	repoGetter := &MockRepoGetter{}
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").Return(mockRepo, nil).Maybe()

	worker := &MockWorker{}
	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true).Maybe()
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(nil).Maybe()

	metrics := RegisterJobMetrics(prometheus.NewPedanticRegistry())
	driver := newTestConcurrentDriver(t, 1, store, repoGetter, history, &metrics, worker)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
	}, false)

	select {
	case <-completeCalled:
	case <-time.After(5 * time.Second):
		t.Fatal("job never reached Complete")
	}

	// A rate-limited retry would re-claim within tens of milliseconds; give it
	// ample time to prove the key was dropped instead.
	time.Sleep(300 * time.Millisecond)
	assert.Equal(t, int32(1), claims.Load(), "a post-claim failure must not re-run the job from the queue")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_CooldownBlocksDirtyRedeliveryAfterPostClaimFailure
// reproduces the resync-races-claim hazard: a resync that snapshots the job
// before the worker's claim lands adds the in-flight key, so the queue marks it
// dirty and redelivers it the moment the failed run returns. The post-claim
// cooldown must drop that redelivery (no immediate re-run of side effects),
// while a create event — a new job incarnation reusing the deterministic name —
// clears the cooldown and processes normally.
func TestConcurrentJobDriver_CooldownBlocksDirtyRedeliveryAfterPostClaimFailure(t *testing.T) {
	claimedJob := makeTestJob("1")
	claimedJob.Labels = map[string]string{
		LabelJobClaim:      "1000000000000",
		LabelJobClaimOwner: "owner-A",
	}

	var claims atomic.Int32
	completeStarted := make(chan struct{})
	releaseComplete := make(chan struct{})

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			if claims.Add(1) > 1 {
				// Later attempts only need to be counted.
				return nil, nil, ErrAlreadyClaimed
			}
			return claimedJob.DeepCopy(), func() {}, nil
		}).Maybe()
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
			return job.DeepCopy(), nil
		}).Maybe()
	store.EXPECT().Get(mock.Anything, mock.Anything, mock.Anything).Return(claimedJob.DeepCopy(), nil).Maybe()
	store.EXPECT().RenewLease(mock.Anything, mock.Anything).Return(nil).Maybe()
	store.EXPECT().Complete(mock.Anything, mock.Anything).
		RunAndReturn(func(context.Context, *provisioning.Job) error {
			close(completeStarted)
			<-releaseComplete
			return errors.New("transient delete failure")
		}).Once()

	history := &MockHistoryWriter{}
	history.EXPECT().WriteJob(mock.Anything, mock.Anything).Return(nil).Maybe()

	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(makeRepoConfig("test-repo", nil, nil))

	repoGetter := &MockRepoGetter{}
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").Return(mockRepo, nil).Maybe()

	worker := &MockWorker{}
	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true).Maybe()
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(nil).Maybe()

	metrics := RegisterJobMetrics(prometheus.NewPedanticRegistry())
	driver := newTestConcurrentDriver(t, 1, store, repoGetter, history, &metrics, worker)
	handler := driver.EventHandler()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
	}, false)

	// While the run is in flight (blocked in Complete), a resync that snapshotted
	// the job before the claim delivers it as a full unclaimed update. This marks
	// the in-flight key dirty.
	<-completeStarted
	stale := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job", ResourceVersion: "7"},
	}
	handler.UpdateFunc(stale, stale)

	// Complete fails → errPostClaim → cooldown. The dirty redelivery arrives
	// immediately but must be dropped, not claimed.
	close(releaseComplete)
	time.Sleep(300 * time.Millisecond)
	assert.Equal(t, int32(1), claims.Load(), "the dirty redelivery must sit out the post-claim cooldown")

	// A create event announces a new incarnation on the same deterministic name:
	// it clears the cooldown and is processed without waiting it out.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
	}, false)
	require.Eventually(t, func() bool { return claims.Load() == 2 }, 2*time.Second, 10*time.Millisecond,
		"a new incarnation must not inherit its predecessor's cooldown")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_DuplicateEventsCauseNoDuplicateProcessing verifies
// that re-adding a key while it is being processed leads to at most one
// redelivery, whose claim then observes the job as taken.
func TestConcurrentJobDriver_DuplicateEventsCauseNoDuplicateProcessing(t *testing.T) {
	firstClaimStarted := make(chan struct{})
	release := make(chan struct{})
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "ns1", "job1", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			if claims.Add(1) == 1 {
				close(firstClaimStarted)
				<-release
			}
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	event := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"}}
	driver.EventHandler().AddFunc(event, false)

	// While the first claim is in flight, duplicate events for the same key arrive.
	<-firstClaimStarted
	driver.EventHandler().AddFunc(event, false)
	driver.EventHandler().AddFunc(event, false)
	close(release)

	// The duplicates collapse into a single redelivery after the first attempt.
	require.Eventually(t, func() bool { return claims.Load() == 2 }, 2*time.Second, 10*time.Millisecond)
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(2), claims.Load(), "duplicate events must coalesce into at most one redelivery")

	cancel()
	require.NoError(t, <-runDone)
}

// A claim 404 while the freshness floor says the job was announced is a
// read-visibility lag, not a missing job: the claim is retried until the read
// path catches up (here: until the job resolves as claimed elsewhere).
func TestConcurrentJobDriver_StaleNotFoundClaimIsRetried(t *testing.T) {
	var claims atomic.Int32
	notFound := apierrors.NewNotFound(provisioning.JobResourceInfo.GroupVersionResource().GroupResource(), "job1")

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "ns1", "job1", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			if claims.Add(1) < 3 {
				return nil, nil, notFound
			}
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)
	floor := usinformer.NewRVFloor()
	// A realistic snowflake-range resource version, as the notification carries.
	floor.Raise("ns1", "job1", 200000000000000000)
	driver.TrackFloor(floor)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
	}, false)

	require.Eventually(t, func() bool { return claims.Load() == 3 }, 2*time.Second, 10*time.Millisecond)

	// The terminal outcome (claimed elsewhere) must stop the retries.
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(3), claims.Load(), "a stale 404 must be retried until the job resolves")

	cancel()
	require.NoError(t, <-runDone)
}

// Without an outstanding floor a claim 404 stays trusted — the job completed
// and was deleted — so the key is dropped without retries.
func TestConcurrentJobDriver_TrustedNotFoundClaimIsDropped(t *testing.T) {
	var claims atomic.Int32
	notFound := apierrors.NewNotFound(provisioning.JobResourceInfo.GroupVersionResource().GroupResource(), "job1")

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "ns1", "job1", "0").
		RunAndReturn(func(context.Context, string, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, notFound
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)
	driver.TrackFloor(usinformer.NewRVFloor()) // tracked, but nothing announced this job

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
	}, false)

	require.Eventually(t, func() bool { return claims.Load() == 1 }, 2*time.Second, 10*time.Millisecond)

	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(1), claims.Load(), "a trusted 404 must not be retried")

	cancel()
	require.NoError(t, <-runDone)
}
