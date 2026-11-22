package keyqueue

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/tools/cache"
	testingclock "k8s.io/utils/clock/testing"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

const (
	testKind     = "test"
	testResource = "tests"
	testKey      = "ns/obj"
)

func testObject(name, rv string) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: name, ResourceVersion: rv}}
}

// newTestWorkers fills the config fields a test leaves unset. A nil process
// panics if called.
func newTestWorkers(t *testing.T, cfg Config, process func(ctx context.Context, key string) error) (*Workers, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewPedanticRegistry()
	cfg.Controller = "TestController"
	cfg.Kind = testKind
	cfg.Logger = logging.DefaultLogger
	cfg.Registry = reg
	if cfg.Processed == nil {
		cfg.Processed = usinformer.NewProcessedMetrics(reg, testResource, false)
	}
	if cfg.MaxAttempts == 0 {
		cfg.MaxAttempts = 3
	}
	if cfg.Retryable == nil {
		cfg.Retryable = apierrors.IsServiceUnavailable
	}
	if cfg.DrainTimeout == 0 {
		cfg.DrainTimeout = 5 * time.Second
	}
	w := New(cfg, func(ctx context.Context, key string) ([]any, error) {
		return nil, process(ctx, key)
	})
	t.Cleanup(w.queue.ShutDown)
	return w, reg
}

// The delaying queue's waitingLoop builds its timer relative to the clock's
// current time, so a Step that lands mid-iteration is lost; keep stepping until
// the delayed retry is enqueued.
func stepUntilQueued(t *testing.T, clock *testingclock.FakeClock, w *Workers) {
	t.Helper()
	require.Eventually(t, func() bool {
		clock.Step(time.Second)
		return w.queue.Len() > 0
	}, 5*time.Second, time.Millisecond, "delayed retry was never enqueued")
}

func runWorkers(w *Workers, ctx context.Context, workers int, onShutdown func()) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		w.Run(ctx, workers, func() {}, onShutdown)
		close(done)
	}()
	return done
}

func TestWorkersDeduplicatesEnqueueBeforeProcessing(t *testing.T) {
	var processedKeys []string
	w, _ := newTestWorkers(t, Config{}, func(_ context.Context, key string) error {
		processedKeys = append(processedKeys, key)
		return nil
	})

	objs := []*metav1.PartialObjectMetadata{
		testObject("a", ""),
		testObject("b", ""),
		{ObjectMeta: metav1.ObjectMeta{Namespace: "other", Name: "a"}},
	}
	handler := w.EventHandler()
	for _, obj := range objs {
		handler.AddFunc(obj, true)
		for range 5 {
			handler.UpdateFunc(obj, obj.DeepCopy())
		}
	}

	require.Equal(t, len(objs), w.queue.Len())
	for range objs {
		require.True(t, w.ProcessNextWorkItem(t.Context()))
	}
	assert.ElementsMatch(t, []string{"ns/a", "ns/b", "other/a"}, processedKeys)
	assert.Zero(t, w.queue.Len())
	assert.Empty(t, w.triggers)
}

// Every reconcile can produce a status update that re-enqueues its own key, so
// events arriving while a key is in flight must collapse to one more round.
func TestWorkersDeduplicatesEnqueueWhileProcessing(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		t.Cleanup(cancel)
		release := make(chan struct{})
		releaseFirst := sync.OnceFunc(func() { close(release) })
		t.Cleanup(releaseFirst)
		var processCount, otherProcessCount atomic.Int32
		w, _ := newTestWorkers(t, Config{}, func(_ context.Context, key string) error {
			switch key {
			case testKey:
				if processCount.Add(1) == 1 {
					<-release
				}
			case "other/obj":
				otherProcessCount.Add(1)
			default:
				t.Errorf("unexpected key %q", key)
			}
			return nil
		})

		obj := testObject("obj", "")
		handler := w.EventHandler()
		handler.AddFunc(obj, true)
		runDone := runWorkers(w, ctx, 2, func() {})
		synctest.Wait()
		require.Equal(t, int32(1), processCount.Load())

		for range 5 {
			handler.UpdateFunc(obj, obj.DeepCopy())
		}
		handler.AddFunc(&metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: "other", Name: "obj"}}, false)
		synctest.Wait()
		assert.Equal(t, int32(1), processCount.Load(), "the in-flight key must not be processed by another worker")
		assert.Equal(t, int32(1), otherProcessCount.Load(), "another key can be processed concurrently")

		releaseFirst()
		synctest.Wait()
		cancel()
		<-runDone
		assert.Equal(t, int32(2), processCount.Load(), "updates must coalesce into one additional reconciliation")
		assert.Equal(t, int32(1), otherProcessCount.Load())
		assert.Zero(t, w.queue.Len())
		assert.Empty(t, w.triggers)
	})
}

func TestWorkersRetriesAndClearsState(t *testing.T) {
	unavailable := apierrors.NewServiceUnavailable("temporarily unavailable")
	terminal := errors.New("invalid configuration")
	for _, tt := range []struct {
		name     string
		results  []error
		internal bool
	}{
		{name: "retryable error exhausts attempts", results: []error{unavailable, unavailable, unavailable}},
		{name: "non-retryable error", results: []error{terminal}},
		{name: "retry succeeds", results: []error{unavailable, nil}},
		{name: "retry fails permanently", results: []error{unavailable, terminal}},
		{name: "internal retry has no attribution", results: []error{unavailable, nil}, internal: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			clock := testingclock.NewFakeClock(time.Now())
			processCount := 0
			var w *Workers
			w, reg := newTestWorkers(t, Config{Clock: clock}, func(_ context.Context, gotKey string) error {
				require.Equal(t, testKey, gotKey)
				require.Less(t, processCount, len(tt.results), "unexpected retry")
				assert.Equal(t, processCount, w.queue.NumRequeues(testKey))
				err := tt.results[processCount]
				processCount++
				return err
			})
			obj := testObject("obj", "5")
			wantTrigger := "initial"
			if tt.internal {
				w.queue.Add(testKey)
				wantTrigger = ""
			} else {
				w.EventHandler().AddFunc(obj, true)
			}

			for i := range tt.results {
				require.True(t, w.ProcessNextWorkItem(t.Context()))
				if i < len(tt.results)-1 {
					assert.Equal(t, i+1, w.queue.NumRequeues(testKey))
					if tt.internal {
						assert.Empty(t, w.triggers)
					} else {
						assert.Equal(t, wantTrigger, string(w.triggers[testKey]))
					}
					stepUntilQueued(t, clock, w)
				}
			}
			assert.Equal(t, len(tt.results), processCount)
			assert.Zero(t, w.queue.NumRequeues(testKey))
			assert.Empty(t, w.triggers)
			assertOnlyProcessedTrigger(t, reg, wantTrigger)
			assert.Zero(t, w.queue.Len())

			w.process = func(_ context.Context, gotKey string) ([]any, error) {
				assert.Equal(t, testKey, gotKey)
				assert.Zero(t, w.queue.NumRequeues(testKey), "a new event starts with a fresh retry budget")
				return nil, nil
			}
			w.EventHandler().AddFunc(obj, false)
			require.True(t, w.ProcessNextWorkItem(t.Context()))
			assert.Equal(t, 1.0, processedCounterValue(t, reg, "live"))
			assert.Zero(t, w.queue.NumRequeues(testKey))
			assert.Zero(t, w.queue.Len())
			assert.Empty(t, w.triggers)
		})
	}
}

func TestWorkersRetryBackoffUpToMaxAttempts(t *testing.T) {
	// The process-global error backoff retains wall time from package initialization.
	// Keep error logging while excluding that unrelated throttle from fake-time retries.
	previousHandlers := utilruntime.ErrorHandlers
	utilruntime.ErrorHandlers = previousHandlers[:1]
	t.Cleanup(func() { utilruntime.ErrorHandlers = previousHandlers })

	synctest.Test(t, func(t *testing.T) {
		const maxAttempts = 3
		processCount := 0
		w, _ := newTestWorkers(t, Config{MaxAttempts: maxAttempts}, func(context.Context, string) error {
			processCount++
			return apierrors.NewServiceUnavailable("test")
		})

		w.queue.Add(testKey)
		for attempt := range maxAttempts {
			require.True(t, w.ProcessNextWorkItem(t.Context()))
			if attempt == maxAttempts-1 {
				break
			}
			assert.Equal(t, attempt+1, w.queue.NumRequeues(testKey))

			// Let the delaying queue register this attempt's exponential backoff timer.
			synctest.Wait()
			delay := 5 * time.Millisecond * (1 << attempt)
			synctest.Sleep(delay - time.Nanosecond)
			assert.Zero(t, w.queue.Len(), "the retry must wait for its exponential backoff")
			synctest.Sleep(time.Nanosecond)
			require.Equal(t, 1, w.queue.Len())
		}

		assert.Equal(t, maxAttempts, processCount, "a retryable failure should be tried exactly MaxAttempts times")
		assert.Zero(t, w.queue.NumRequeues(testKey), "the final attempt must clear the retry budget")
		assert.Zero(t, w.queue.Len())
	})
}

func TestWorkersDirtyRedeliveryKeepsTrigger(t *testing.T) {
	for _, tt := range []struct {
		name       string
		firstError error
	}{
		{name: "success"},
		{name: "terminal error", firstError: errors.New("invalid configuration")},
		{name: "retryable error", firstError: apierrors.NewServiceUnavailable("temporarily unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			clock := testingclock.NewFakeClock(time.Now())
			obj := testObject("obj", "5")
			updated := testObject("obj", "6")
			processCount := 0
			var w *Workers
			w, reg := newTestWorkers(t, Config{Clock: clock}, func(context.Context, string) error {
				processCount++
				if processCount == 1 {
					// A live update, such as the status update the reconcile
					// itself produced, arrives while the key is in flight.
					w.EventHandler().UpdateFunc(obj, updated)
					return tt.firstError
				}
				return nil
			})

			w.EventHandler().AddFunc(obj, true)
			require.True(t, w.ProcessNextWorkItem(t.Context()))
			require.Equal(t, 1, w.queue.Len())
			assert.Equal(t, "live", string(w.triggers[testKey]), "completion and retry must preserve the newer event")
			require.True(t, w.ProcessNextWorkItem(t.Context()))

			if apierrors.IsServiceUnavailable(tt.firstError) {
				stepUntilQueued(t, clock, w)
				// The dirty delivery consumes the retry budget. The delayed retry
				// still arrives, but has no informer event to count after success.
				require.True(t, w.ProcessNextWorkItem(t.Context()))
				assert.Equal(t, 3, processCount)
				assertOnlyProcessedTrigger(t, reg, "initial")
			} else {
				assert.Equal(t, 2, processCount)
				assert.Equal(t, 1.0, processedCounterValue(t, reg, "initial"))
				assert.Equal(t, 1.0, processedCounterValue(t, reg, "live"))
				assert.Zero(t, processedCounterValue(t, reg, "relist"))
			}
			assert.Zero(t, w.queue.NumRequeues(testKey))
			assert.Zero(t, w.queue.Len())
			assert.Empty(t, w.triggers)
		})
	}
}

// A key added straight to the queue, as a token read-after-write AddAfter does,
// has no informer event behind it and must not masquerade as a relist recovery.
func TestWorkersInternalRescheduleNotCounted(t *testing.T) {
	w, reg := newTestWorkers(t, Config{}, func(context.Context, string) error { return nil })

	w.Queue().Add(testKey)
	require.True(t, w.ProcessNextWorkItem(t.Context()))

	assertOnlyProcessedTrigger(t, reg, "")
}

func TestWorkersRecordsProcessingByTrigger(t *testing.T) {
	obj := func(rv string) *metav1.PartialObjectMetadata { return testObject("obj", rv) }
	tests := []struct {
		name        string
		natsBacked  bool
		feed        func(h cache.ResourceEventHandlerDetailedFuncs)
		wantTrigger string
	}{
		{
			name:        "apiserver live add",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(obj("5"), false) },
			wantTrigger: "live",
		},
		{
			name:        "initial list add",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(obj("5"), true) },
			wantTrigger: "initial",
		},
		{
			name:        "resync update is relist",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.UpdateFunc(obj("5"), obj("5")) },
			wantTrigger: "relist",
		},
		{
			name:        "apiserver live update",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.UpdateFunc(obj("5"), obj("6")) },
			wantTrigger: "live",
		},
		{
			name:        "nats relist add",
			natsBacked:  true,
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(obj("5"), false) },
			wantTrigger: "relist",
		},
		{
			name:        "nats live add",
			natsBacked:  true,
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(obj(""), false) },
			wantTrigger: "live",
		},
		{
			name: "coalesced updates keep initial trigger",
			feed: func(h cache.ResourceEventHandlerDetailedFuncs) {
				h.AddFunc(obj("5"), true)
				h.UpdateFunc(obj("5"), obj("6"))
				h.UpdateFunc(obj("6"), obj("6"))
			},
			wantTrigger: "initial",
		},
		{
			name: "coalesced relist keeps live trigger",
			feed: func(h cache.ResourceEventHandlerDetailedFuncs) {
				h.AddFunc(obj("5"), false)
				h.UpdateFunc(obj("5"), obj("5"))
			},
			wantTrigger: "live",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			processedReg := prometheus.NewPedanticRegistry()
			w, _ := newTestWorkers(t, Config{
				Processed: usinformer.NewProcessedMetrics(processedReg, testResource, tt.natsBacked),
			}, func(context.Context, string) error { return nil })

			tt.feed(w.EventHandler())
			require.True(t, w.ProcessNextWorkItem(t.Context()))

			assertOnlyProcessedTrigger(t, processedReg, tt.wantTrigger)
		})
	}
}

// The apiserver informer delivers whole objects, the NATS one a metadata
// projection, and deletes a tombstone; each must key to namespace/name.
func TestWorkersKeysEveryDeliveryShape(t *testing.T) {
	for _, tc := range []struct {
		name   string
		obj    any
		wantRV string
	}{
		{name: "metadata projection", obj: testObject("obj", "42"), wantRV: "42"},
		{name: "delete tombstone", obj: cache.DeletedFinalStateUnknown{Key: testKey, Obj: testObject("obj", "")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, _ := newTestWorkers(t, Config{}, nil)
			w.enqueue(tc.obj, usinformer.TriggerLive)
			key, _ := w.queue.Get()
			assert.Equal(t, testKey, key)
			assert.Equal(t, tc.wantRV, resourceVersion(tc.obj))
		})
	}
}

func TestWorkersRunDrainWaitsForInFlight(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		var processed atomic.Bool
		w, _ := newTestWorkers(t, Config{DrainTimeout: 5 * time.Second}, func(context.Context, string) error {
			<-release
			processed.Store(true)
			return nil
		})
		w.queue.Add(testKey)

		ctx, cancel := context.WithCancel(t.Context())
		runDone := runWorkers(w, ctx, 1, func() {})
		synctest.Wait()
		cancel()

		time.Sleep(time.Second)
		synctest.Wait()
		select {
		case <-runDone:
			t.Fatal("Run returned before the in-flight key completed")
		default:
		}

		close(release)
		<-runDone
		assert.True(t, processed.Load())
	})
}

func TestWorkersRunDrainTimeoutForcesShutdown(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		stuck := make(chan struct{})
		t.Cleanup(func() { close(stuck) })
		w, _ := newTestWorkers(t, Config{DrainTimeout: 200 * time.Millisecond}, func(context.Context, string) error {
			<-stuck
			return nil
		})
		w.queue.Add(testKey)

		ctx, cancel := context.WithCancel(t.Context())
		runDone := runWorkers(w, ctx, 1, func() {})
		synctest.Wait()
		cancel()
		start := time.Now()
		<-runDone
		assert.Equal(t, 200*time.Millisecond, time.Since(start))
	})
}

func TestWorkersRunCallsOnShutdownBeforeDrain(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		w, _ := newTestWorkers(t, Config{}, func(context.Context, string) error {
			<-release
			return nil
		})
		w.queue.Add(testKey)

		shutdownCalled := make(chan struct{})
		ctx, cancel := context.WithCancel(t.Context())
		runDone := runWorkers(w, ctx, 1, func() { close(shutdownCalled) })
		synctest.Wait()
		cancel()

		<-shutdownCalled
		select {
		case <-runDone:
			t.Fatal("Run returned before draining")
		default:
		}
		close(release)
		<-runDone
	})
}

func TestWorkersQueueMetrics(t *testing.T) {
	w, reg := newTestWorkers(t, Config{}, nil)
	const (
		size = "grafana_provisioning_test_worker_queue_size"
		wait = "grafana_provisioning_test_worker_queue_wait_seconds"
	)
	require.Equal(t, 0.0, gaugeValue(t, reg, size))
	require.Zero(t, histogramSampleCount(t, reg, wait))

	// The workqueue coalesces the re-add onto the still-queued key, so only two
	// keys are ever picked up and only two wait times are observed.
	w.queue.Add("ns/a")
	w.queue.Add("ns/a")
	w.queue.Add("ns/b")
	require.Equal(t, 2.0, gaugeValue(t, reg, size))

	key, _ := w.queue.Get()
	w.queue.Done(key)
	require.Equal(t, 1.0, gaugeValue(t, reg, size))
	require.Equal(t, uint64(1), histogramSampleCount(t, reg, wait))

	key, _ = w.queue.Get()
	w.queue.Done(key)
	require.Equal(t, uint64(2), histogramSampleCount(t, reg, wait))
}

func processedCounterValue(t *testing.T, reg *prometheus.Registry, source string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_events_processed_total" {
			continue
		}
		for _, m := range mf.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["resource"] == testResource && labels["source"] == source {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

// assertOnlyProcessedTrigger asserts exactly wantTrigger advanced to 1, the
// others staying at 0. An empty wantTrigger expects nothing counted.
func assertOnlyProcessedTrigger(t *testing.T, reg *prometheus.Registry, wantTrigger string) {
	t.Helper()
	for _, source := range []string{"live", "relist", "initial"} {
		want := 0.0
		if source == wantTrigger {
			want = 1.0
		}
		assert.Equal(t, want, processedCounterValue(t, reg, source), "%s counter", source)
	}
}

func gaugeValue(t *testing.T, g prometheus.Gatherer, name string) float64 {
	t.Helper()
	mfs, err := g.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() == name {
			require.Len(t, mf.GetMetric(), 1)
			return mf.GetMetric()[0].GetGauge().GetValue()
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0
}

func histogramSampleCount(t *testing.T, g prometheus.Gatherer, name string) uint64 {
	t.Helper()
	count, _ := histogramSamples(t, g, name)
	return count
}

func histogramSamples(t *testing.T, g prometheus.Gatherer, name string) (uint64, float64) {
	t.Helper()
	mfs, err := g.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() == name {
			require.Len(t, mf.GetMetric(), 1)
			h := mf.GetMetric()[0].GetHistogram()
			return h.GetSampleCount(), h.GetSampleSum()
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0, 0
}
