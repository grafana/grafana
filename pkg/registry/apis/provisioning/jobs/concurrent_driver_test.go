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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func newTestConcurrentDriver(t *testing.T, numDrivers int, jobInterval time.Duration, store Store, repoGetter RepoGetter, history HistoryWriter, metrics *JobMetrics, workers ...Worker) *ConcurrentJobDriver {
	t.Helper()
	driver, err := NewConcurrentJobDriver(
		numDrivers,
		time.Minute, jobInterval, 30*time.Second,
		store, repoGetter, history,
		prometheus.NewRegistry(),
		metrics,
		workers...,
	)
	require.NoError(t, err)
	return driver
}

// TestConcurrentJobDriver_EventHandler_Enqueue verifies which informer add
// events feed the work queue: minimal (NATS-style) objects and unclaimed full
// objects enqueue, while full objects that already carry a claim are skipped.
func TestConcurrentJobDriver_EventHandler_Enqueue(t *testing.T) {
	driver := newTestConcurrentDriver(t, 1, time.Hour, &MockStore{}, &MockRepoGetter{}, &MockHistoryWriter{}, nil)
	handler := driver.EventHandler()

	// A claimed full object (apiserver informer initial list) is skipped.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "ns1",
			Name:      "claimed-job",
			Labels:    map[string]string{LabelJobClaim: "1000000000000"},
		},
	})
	assert.Equal(t, 0, driver.queue.Len(), "claimed jobs must not enqueue")

	// A minimal object (NATS live event: namespace+name only) enqueues.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "new-job"},
	})
	assert.Equal(t, 1, driver.queue.Len())

	// Duplicate adds of the same key coalesce while queued.
	handler.AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "new-job"},
	})
	assert.Equal(t, 1, driver.queue.Len(), "the queue must deduplicate keys")
}

// TestConcurrentJobDriver_ClaimedElsewhereIsDropped verifies that a key whose
// job is already claimed by another worker is dropped without retries.
func TestConcurrentJobDriver_ClaimedElsewhereIsDropped(t *testing.T) {
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().ListUnclaimedJobs(mock.Anything, mock.Anything).Return(nil, nil).Maybe()
	store.EXPECT().Claim(mock.Anything, "ns1", "job1").
		RunAndReturn(func(context.Context, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, time.Hour, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
	})

	require.Eventually(t, func() bool { return claims.Load() == 1 }, 2*time.Second, 10*time.Millisecond)

	// The key must be forgotten, not retried.
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(1), claims.Load(), "an already-claimed job must not be retried")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_TransientErrorsRetryUntilDropped verifies that
// transient claim failures are retried with rate limiting up to
// maxClaimAttempts, and then the key is dropped (the backstop poll re-adds it
// if the job is still unclaimed).
func TestConcurrentJobDriver_TransientErrorsRetryUntilDropped(t *testing.T) {
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().ListUnclaimedJobs(mock.Anything, mock.Anything).Return(nil, nil).Maybe()
	store.EXPECT().Claim(mock.Anything, "ns1", "job1").
		RunAndReturn(func(context.Context, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, errors.New("transient API error")
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, time.Hour, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
	})

	require.Eventually(t, func() bool { return claims.Load() == maxClaimAttempts }, 2*time.Second, 10*time.Millisecond)

	// After the attempts are exhausted the key must be dropped.
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(maxClaimAttempts), claims.Load(), "the key must be dropped after maxClaimAttempts")

	cancel()
	require.NoError(t, <-runDone)
}

// TestConcurrentJobDriver_BackstopEnqueuesAtStartup verifies that the backstop
// poller feeds unclaimed jobs into the queue immediately at startup, without
// waiting for the first tick.
func TestConcurrentJobDriver_BackstopEnqueuesAtStartup(t *testing.T) {
	unclaimed := []*provisioning.Job{
		{ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job-a"}},
		{ObjectMeta: metav1.ObjectMeta{Namespace: "ns2", Name: "job-b"}},
	}

	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().ListUnclaimedJobs(mock.Anything, mock.Anything).Return(unclaimed, nil).Maybe()
	store.EXPECT().Claim(mock.Anything, mock.Anything, mock.Anything).
		RunAndReturn(func(context.Context, string, string) (*provisioning.Job, func(), error) {
			claims.Add(1)
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	// jobInterval of an hour: any claim can only come from the startup poll.
	driver := newTestConcurrentDriver(t, 2, time.Hour, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	require.Eventually(t, func() bool { return claims.Load() >= 2 }, 2*time.Second, 10*time.Millisecond,
		"both unclaimed jobs should be claimed from the startup poll")

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
	store.EXPECT().ListUnclaimedJobs(mock.Anything, mock.Anything).Return(nil, nil).Maybe()
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job").
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
	driver := newTestConcurrentDriver(t, 1, time.Hour, store, repoGetter, history, &metrics, worker)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	// A NATS-style minimal add event carries only the key.
	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
	})

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

// TestConcurrentJobDriver_DuplicateEventsCauseNoDuplicateProcessing verifies
// that re-adding a key while it is being processed leads to at most one
// redelivery, whose claim then observes the job as taken.
func TestConcurrentJobDriver_DuplicateEventsCauseNoDuplicateProcessing(t *testing.T) {
	firstClaimStarted := make(chan struct{})
	release := make(chan struct{})
	var claims atomic.Int32

	store := &MockStore{}
	store.EXPECT().ListUnclaimedJobs(mock.Anything, mock.Anything).Return(nil, nil).Maybe()
	store.EXPECT().Claim(mock.Anything, "ns1", "job1").
		RunAndReturn(func(context.Context, string, string) (*provisioning.Job, func(), error) {
			if claims.Add(1) == 1 {
				close(firstClaimStarted)
				<-release
			}
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	driver := newTestConcurrentDriver(t, 1, time.Hour, store, &MockRepoGetter{}, &MockHistoryWriter{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	event := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"}}
	driver.EventHandler().AddFunc(event)

	// While the first claim is in flight, duplicate events for the same key arrive.
	<-firstClaimStarted
	driver.EventHandler().AddFunc(event)
	driver.EventHandler().AddFunc(event)
	close(release)

	// The duplicates collapse into a single redelivery after the first attempt.
	require.Eventually(t, func() bool { return claims.Load() == 2 }, 2*time.Second, 10*time.Millisecond)
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, int32(2), claims.Load(), "duplicate events must coalesce into at most one redelivery")

	cancel()
	require.NoError(t, <-runDone)
}
