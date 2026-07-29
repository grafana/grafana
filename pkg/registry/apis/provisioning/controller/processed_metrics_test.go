package controller

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// processedCounterValue reads grafana_provisioning_events_processed_total for a
// resource and source.
func processedCounterValue(t *testing.T, reg *prometheus.Registry, resource, source string) float64 {
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
			if labels["resource"] == resource && labels["source"] == source {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

// assertOnlyProcessedTrigger asserts exactly wantTrigger advanced to 1 for the
// resource, the others staying at 0.
func assertOnlyProcessedTrigger(t *testing.T, reg *prometheus.Registry, resource, wantTrigger string) {
	t.Helper()
	for _, source := range []string{"live", "relist", "initial"} {
		want := 0.0
		if source == wantTrigger {
			want = 1.0
		}
		assert.Equal(t, want, processedCounterValue(t, reg, resource, source), "%s counter", source)
	}
}

// TestRepositoryController_RecordsProcessingByTrigger verifies the controller
// counts the start of each reconcile under resource="repositories", attributed
// to what enqueued the key.
func TestRepositoryController_RecordsProcessingByTrigger(t *testing.T) {
	repo := func(rv string) *provisioning.Repository {
		return &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "repo", ResourceVersion: rv}}
	}
	tests := []struct {
		name        string
		natsBacked  bool
		feed        func(h cache.ResourceEventHandlerDetailedFuncs)
		wantTrigger string
	}{
		{
			name:        "apiserver live add",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(repo("5"), false) },
			wantTrigger: "live",
		},
		{
			name:        "initial list add",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(repo("5"), true) },
			wantTrigger: "initial",
		},
		{
			name:        "resync update is relist",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.UpdateFunc(repo("5"), repo("5")) },
			wantTrigger: "relist",
		},
		{
			name:        "nats relist add",
			natsBacked:  true,
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(repo("5"), false) },
			wantTrigger: "relist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()
			processedDone := make(chan struct{})

			rc := &RepositoryController{
				queue: workqueue.NewTypedRateLimitingQueueWithConfig(
					workqueue.DefaultTypedControllerRateLimiter[string](),
					workqueue.TypedRateLimitingQueueConfig[string]{Name: "test-processed"},
				),
				logger:       logging.DefaultLogger.With("logger", "test"),
				drainTimeout: 5 * time.Second,
				processed:    usinformer.NewProcessedMetrics(reg, "repositories", tt.natsBacked),
				keyFunc:      repoKeyFunc,
				processFn: func(string) error {
					close(processedDone)
					return nil
				},
			}
			rc.enqueueRepository = rc.enqueue

			tt.feed(rc.EventHandler())

			ctx, cancel := context.WithCancel(context.Background())
			runDone := make(chan struct{})
			go func() {
				rc.Run(ctx, 1, func() {}, func() {})
				close(runDone)
			}()

			select {
			case <-processedDone:
			case <-time.After(5 * time.Second):
				t.Fatal("key was not processed")
			}
			cancel()
			<-runDone

			assertOnlyProcessedTrigger(t, reg, "repositories", tt.wantTrigger)
		})
	}
}

// TestRepositoryController_DirtyRedeliveryKeepsLiveTrigger reproduces the race a
// live event (e.g. a status update the reconcile itself produces) that arrives
// while the key is in flight: it marks the key dirty and records a fresh live
// attribution, which the completing reconcile's queue.Forget must not clobber.
// So the redelivery is counted as live, not misattributed to relist.
func TestRepositoryController_DirtyRedeliveryKeepsLiveTrigger(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()

	rc := &RepositoryController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{Name: "test-dirty"},
		),
		logger:    logging.DefaultLogger.With("logger", "test"),
		processed: usinformer.NewProcessedMetrics(reg, "repositories", false),
		keyFunc:   repoKeyFunc,
	}
	rc.enqueueRepository = rc.enqueue

	var enqueuedDuringFlight atomic.Bool
	rc.processFn = func(string) error {
		// On the first reconcile, a live update (bumped RV) arrives while the key
		// is in flight — the classic self-induced status update — marking it dirty.
		if enqueuedDuringFlight.CompareAndSwap(false, true) {
			rc.EventHandler().UpdateFunc(
				&provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "repo", ResourceVersion: "5"}},
				&provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "repo", ResourceVersion: "6"}},
			)
		}
		return nil
	}

	// Initial live add (apiserver watch, full RV, non-initial).
	rc.EventHandler().AddFunc(&provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "repo", ResourceVersion: "5"}}, false)

	ctx := context.Background()
	require.True(t, rc.processNextWorkItem(ctx)) // first pickup: live; enqueues the dirty live update
	require.True(t, rc.processNextWorkItem(ctx)) // dirty redelivery: must stay live

	assert.Equal(t, 2.0, processedCounterValue(t, reg, "repositories", "live"), "both pickups are live")
	assert.Equal(t, 0.0, processedCounterValue(t, reg, "repositories", "relist"), "no pickup falls back to relist")
}

// TestConnectionController_RecordsProcessingByTrigger verifies the connection
// controller counts the start of each reconcile under resource="connections".
func TestConnectionController_RecordsProcessingByTrigger(t *testing.T) {
	conn := func(rv string) *provisioning.Connection {
		return &provisioning.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "conn", ResourceVersion: rv}}
	}
	tests := []struct {
		name        string
		natsBacked  bool
		feed        func(h cache.ResourceEventHandlerDetailedFuncs)
		wantTrigger string
	}{
		{
			name:        "apiserver live add",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(conn("5"), false) },
			wantTrigger: "live",
		},
		{
			name:        "initial list add",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.AddFunc(conn("5"), true) },
			wantTrigger: "initial",
		},
		{
			name:        "resync update is relist",
			feed:        func(h cache.ResourceEventHandlerDetailedFuncs) { h.UpdateFunc(conn("5"), conn("5")) },
			wantTrigger: "relist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()
			processedDone := make(chan struct{})

			cc := &ConnectionController{
				queue: workqueue.NewTypedRateLimitingQueueWithConfig(
					workqueue.DefaultTypedControllerRateLimiter[*connectionQueueItem](),
					workqueue.TypedRateLimitingQueueConfig[*connectionQueueItem]{Name: "test-processed"},
				),
				logger:       logging.DefaultLogger.With("logger", "test"),
				drainTimeout: 5 * time.Second,
				processed:    usinformer.NewProcessedMetrics(reg, "connections", tt.natsBacked),
				processFn: func(context.Context, *connectionQueueItem) error {
					close(processedDone)
					return nil
				},
			}

			tt.feed(cc.EventHandler())

			ctx, cancel := context.WithCancel(context.Background())
			runDone := make(chan struct{})
			go func() {
				cc.Run(ctx, 1, func() {}, func() {})
				close(runDone)
			}()

			select {
			case <-processedDone:
			case <-time.After(5 * time.Second):
				t.Fatal("key was not processed")
			}
			cancel()
			<-runDone

			assertOnlyProcessedTrigger(t, reg, "connections", tt.wantTrigger)
		})
	}
}
