package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// newClassifierDriver builds a driver with no workers, used only to exercise the
// EventHandler classifier and the triggers map. natsBacked disambiguates a
// full-RV non-initial add (relist under NATS, live under the apiserver watch).
func newClassifierDriver(t *testing.T, natsBacked bool) *ConcurrentJobDriver {
	t.Helper()
	driver, err := NewConcurrentJobDriver(
		1,
		time.Minute, 30*time.Second, 30*time.Second,
		&MockStore{}, &MockRepoGetter{}, &MockHistoryWriter{},
		prometheus.NewRegistry(),
		nil,
		natsBacked,
	)
	require.NoError(t, err)
	return driver
}

// triggerFor reads the recorded attribution for key under the driver's mutex.
func triggerFor(driver *ConcurrentJobDriver, key string) (claimTrigger, bool) {
	driver.mu.Lock()
	defer driver.mu.Unlock()
	queued, ok := driver.triggers[key]
	return queued.trigger, ok
}

// TestEventHandler_Classifies covers how each informer delivery shape is
// attributed at enqueue time.
func TestEventHandler_Classifies(t *testing.T) {
	const key = "ns1/job1"

	// A minimal add (NATS live event: no resource version) is always live,
	// regardless of the backing source.
	for _, natsBacked := range []bool{true, false} {
		driver := newClassifierDriver(t, natsBacked)
		driver.EventHandler().AddFunc(&provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"},
		}, false)
		got, ok := triggerFor(driver, key)
		require.True(t, ok)
		assert.Equal(t, triggerLive, got, "minimal add must be live (natsBacked=%v)", natsBacked)
	}

	// A full-RV add from the informer's initial list is initial on any backend.
	for _, natsBacked := range []bool{true, false} {
		driver := newClassifierDriver(t, natsBacked)
		driver.EventHandler().AddFunc(&provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1", ResourceVersion: "5"},
		}, true)
		got, ok := triggerFor(driver, key)
		require.True(t, ok)
		assert.Equal(t, triggerInitial, got, "initial-list add must be initial (natsBacked=%v)", natsBacked)
	}

	// A full-RV non-initial add is relist under NATS (a re-list recovered a key
	// never delivered live here) but live under the apiserver watch.
	t.Run("full-RV non-initial add depends on backend", func(t *testing.T) {
		natsDriver := newClassifierDriver(t, true)
		natsDriver.EventHandler().AddFunc(&provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1", ResourceVersion: "5"},
		}, false)
		got, ok := triggerFor(natsDriver, key)
		require.True(t, ok)
		assert.Equal(t, triggerRelist, got, "full-RV non-initial add is relist under NATS")

		apiDriver := newClassifierDriver(t, false)
		apiDriver.EventHandler().AddFunc(&provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1", ResourceVersion: "5"},
		}, false)
		got, ok = triggerFor(apiDriver, key)
		require.True(t, ok)
		assert.Equal(t, triggerLive, got, "full-RV non-initial add is live under the apiserver watch")
	})

	// A resync/re-list update (same stored object as old and new, equal RV) is
	// always relist.
	t.Run("resync update is relist", func(t *testing.T) {
		driver := newClassifierDriver(t, false)
		unclaimed := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1", ResourceVersion: "5"},
		}
		driver.EventHandler().UpdateFunc(unclaimed, unclaimed)
		got, ok := triggerFor(driver, key)
		require.True(t, ok)
		assert.Equal(t, triggerRelist, got)
	})
}

// TestEventHandler_TriggerPrecedence verifies the per-class write policy: a live
// enqueue must never be downgraded by a later relist delivery, but a live
// delivery overwrites an earlier relist attribution (a live create announces a
// new incarnation of the deterministic job name).
func TestEventHandler_TriggerPrecedence(t *testing.T) {
	const key = "ns1/job1"

	live := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1"}}
	relist := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "job1", ResourceVersion: "5"}}

	t.Run("live then relist stays live", func(t *testing.T) {
		driver := newClassifierDriver(t, true)
		driver.EventHandler().AddFunc(live, false)
		driver.EventHandler().UpdateFunc(relist, relist)
		got, ok := triggerFor(driver, key)
		require.True(t, ok)
		assert.Equal(t, triggerLive, got)
	})

	t.Run("relist then live becomes live", func(t *testing.T) {
		driver := newClassifierDriver(t, true)
		driver.EventHandler().UpdateFunc(relist, relist)
		driver.EventHandler().AddFunc(live, false)
		got, ok := triggerFor(driver, key)
		require.True(t, ok)
		assert.Equal(t, triggerLive, got)
	})
}

// TestRecordEventProcessed verifies each trigger increments its own counter and
// that the method is nil-safe.
func TestRecordEventProcessed(t *testing.T) {
	m := RegisterJobMetrics(prometheus.NewPedanticRegistry())

	before := processedCounts(t)
	m.RecordEventProcessed(triggerLive)
	m.RecordEventProcessed(triggerRelist)
	m.RecordEventProcessed(triggerRelist)
	m.RecordEventProcessed(triggerInitial)
	after := processedCounts(t)

	assert.Equal(t, 1.0, after.live-before.live)
	assert.Equal(t, 2.0, after.relist-before.relist)
	assert.Equal(t, 1.0, after.initial-before.initial)

	var nilMetrics *JobMetrics
	assert.NotPanics(t, func() { nilMetrics.RecordEventProcessed(triggerLive) })
}

// TestConcurrentJobDriver_ProcessingAttributed drives a job end to end for each
// delivery class and asserts exactly the matching processing counter advances.
func TestConcurrentJobDriver_ProcessingAttributed(t *testing.T) {
	tests := []struct {
		name       string
		natsBacked bool
		feed       func(h cache.ResourceEventHandlerDetailedFuncs)
		want       claimTrigger
	}{
		{
			name: "live minimal add",
			feed: func(h cache.ResourceEventHandlerDetailedFuncs) {
				h.AddFunc(&provisioning.Job{
					ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
				}, false)
			},
			want: triggerLive,
		},
		{
			name: "initial-list add",
			feed: func(h cache.ResourceEventHandlerDetailedFuncs) {
				h.AddFunc(&provisioning.Job{
					ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job", ResourceVersion: "5"},
				}, true)
			},
			want: triggerInitial,
		},
		{
			name:       "relist update under NATS",
			natsBacked: true,
			feed: func(h cache.ResourceEventHandlerDetailedFuncs) {
				job := &provisioning.Job{
					ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job", ResourceVersion: "5"},
				}
				h.UpdateFunc(job, job)
			},
			want: triggerRelist,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			driver, _, completed := newSuccessfulJobDriver(t, tt.natsBacked)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			runDone := make(chan error, 1)
			go func() { runDone <- driver.Run(ctx) }()

			before := processedCounts(t)
			handler := driver.EventHandler()
			tt.feed(handler)

			select {
			case <-completed:
			case <-time.After(5 * time.Second):
				t.Fatal("job was not completed")
			}

			cancel()
			require.NoError(t, <-runDone)

			after := processedCounts(t)
			assertOnlyTriggerAdvanced(t, tt.want, before, after)

			// The attribution entry must not outlive the key.
			_, ok := triggerFor(driver, "test-ns/test-job")
			assert.False(t, ok, "trigger entry must be forgotten after processing")
		})
	}
}

// TestConcurrentJobDriver_AlreadyClaimedNotAttributed verifies that a job
// claimed by another worker moves no processing counter: recording happens only
// after a successful claim.
func TestConcurrentJobDriver_AlreadyClaimedNotAttributed(t *testing.T) {
	store := &MockStore{}
	claimed := make(chan struct{})
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job").
		RunAndReturn(func(context.Context, string, string) (*provisioning.Job, func(), error) {
			select {
			case <-claimed:
			default:
				close(claimed)
			}
			return nil, nil, ErrAlreadyClaimed
		}).Maybe()

	m := RegisterJobMetrics(prometheus.NewPedanticRegistry())
	driver := newTestConcurrentDriver(t, 1, store, &MockRepoGetter{}, &MockHistoryWriter{}, &m)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	before := processedCounts(t)
	driver.EventHandler().AddFunc(&provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "test-ns", Name: "test-job"},
	}, false)

	<-claimed
	// Give the drop path time to run.
	time.Sleep(100 * time.Millisecond)

	cancel()
	require.NoError(t, <-runDone)

	after := processedCounts(t)
	assert.Equal(t, 0.0, after.live-before.live)
	assert.Equal(t, 0.0, after.relist-before.relist)
	assert.Equal(t, 0.0, after.initial-before.initial)
}

// TestConcurrentJobDriver_RecordsDeliveryLatency verifies that a genuine pickup
// records the delay from the job's creation to it entering the work queue (and
// not the time it then waited for a worker).
func TestConcurrentJobDriver_RecordsDeliveryLatency(t *testing.T) {
	// A job created two seconds ago, so the delivery latency is roughly that.
	claimedJob := makeTestJob("1")
	claimedJob.CreationTimestamp = metav1.NewTime(time.Now().Add(-2 * time.Second))
	claimedJob.Labels = map[string]string{LabelJobClaim: "1000000000000", LabelJobClaimOwner: "owner-A"}

	completed := make(chan struct{})
	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job").Return(claimedJob, func() {}, nil).Once()
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) { return job.DeepCopy(), nil }).Maybe()
	store.EXPECT().Get(mock.Anything, mock.Anything, mock.Anything).Return(claimedJob.DeepCopy(), nil).Maybe()
	store.EXPECT().RenewLease(mock.Anything, mock.Anything).Return(nil).Maybe()
	store.EXPECT().Complete(mock.Anything, mock.Anything).
		RunAndReturn(func(context.Context, *provisioning.Job) error { close(completed); return nil }).Once()

	history := &MockHistoryWriter{}
	history.EXPECT().WriteJob(mock.Anything, mock.Anything).Return(nil).Once()
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(makeRepoConfig("test-repo", nil, nil))
	repoGetter := &MockRepoGetter{}
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").Return(mockRepo, nil)
	worker := &MockWorker{}
	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(nil)

	m := RegisterJobMetrics(prometheus.NewPedanticRegistry())
	driver, err := NewConcurrentJobDriver(1, time.Minute, 30*time.Second, 30*time.Second,
		store, repoGetter, history, prometheus.NewRegistry(), &m, false, worker)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan error, 1)
	go func() { runDone <- driver.Run(ctx) }()

	beforeCount, beforeSum := deliveryLatency(t)
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

	afterCount, afterSum := deliveryLatency(t)
	assert.Equal(t, 1.0, afterCount-beforeCount, "exactly one delivery-latency sample")
	delta := afterSum - beforeSum
	assert.Greater(t, delta, 1.0, "delivery latency is roughly the job's age")
	assert.Less(t, delta, 30.0, "delivery latency excludes any queue wait and is not wildly off")
}

// --- helpers ---

type processedSnapshot struct {
	live    float64
	relist  float64
	initial float64
}

// deliveryLatency returns the jobs-labelled delivery-latency histogram's sample
// count and sum from testRegistry.
func deliveryLatency(t *testing.T) (count, sum float64) {
	t.Helper()
	families, err := testRegistry.Gather()
	require.NoError(t, err)
	mf := findMetric(families, "grafana_provisioning_event_delivery_latency_seconds")
	if mf == nil {
		return 0, 0
	}
	// Aggregate over source for resource=jobs.
	for _, metric := range mf.GetMetric() {
		labels := make(map[string]string)
		for _, lp := range metric.GetLabel() {
			labels[lp.GetName()] = lp.GetValue()
		}
		if labels["resource"] == resourceLabelJobs {
			count += float64(metric.GetHistogram().GetSampleCount())
			sum += metric.GetHistogram().GetSampleSum()
		}
	}
	return count, sum
}

// processedCounts reads the current jobs-labelled processing counters. The
// counters are shared, registered on testRegistry via the RegisterJobMetrics
// singleton (see metrics_test.go), so tests assert deltas around an action.
func processedCounts(t *testing.T) processedSnapshot {
	t.Helper()
	families, err := testRegistry.Gather()
	require.NoError(t, err)
	mf := findMetric(families, "grafana_provisioning_events_processed_total")
	bySource := func(source string) float64 {
		if mf == nil {
			return 0
		}
		return counterValues(mf)[labelKey(map[string]string{"resource": resourceLabelJobs, "source": source})]
	}
	return processedSnapshot{
		live:    bySource("live"),
		relist:  bySource("relist"),
		initial: bySource("initial"),
	}
}

func assertOnlyTriggerAdvanced(t *testing.T, want claimTrigger, before, after processedSnapshot) {
	t.Helper()
	assert.Equal(t, boolToFloat(want == triggerLive), after.live-before.live, "live delta")
	assert.Equal(t, boolToFloat(want == triggerRelist), after.relist-before.relist, "relist delta")
	assert.Equal(t, boolToFloat(want == triggerInitial), after.initial-before.initial, "initial delta")
}

func boolToFloat(b bool) float64 {
	if b {
		return 1.0
	}
	return 0.0
}

// newSuccessfulJobDriver builds a driver whose single job claims and completes
// successfully, returning the singleton metrics and a channel closed on
// completion. It mirrors the setup in TestConcurrentJobDriver_ProcessesJobEndToEnd.
func newSuccessfulJobDriver(t *testing.T, natsBacked bool) (*ConcurrentJobDriver, *JobMetrics, chan struct{}) {
	t.Helper()

	claimedJob := makeTestJob("1")
	claimedJob.Labels = map[string]string{
		LabelJobClaim:      "1000000000000",
		LabelJobClaimOwner: "owner-A",
	}

	completed := make(chan struct{})

	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything, "test-ns", "test-job").
		Return(claimedJob, func() {}, nil).Once()
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

	m := RegisterJobMetrics(prometheus.NewPedanticRegistry())
	driver, err := NewConcurrentJobDriver(
		1,
		time.Minute, 30*time.Second, 30*time.Second,
		store, repoGetter, history,
		prometheus.NewRegistry(),
		&m,
		natsBacked,
		worker,
	)
	require.NoError(t, err)
	return driver, &m, completed
}
