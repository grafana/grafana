package controller

import (
	"context"
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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

// processedCounterValue reads a processing counter's value for a resource label.
func processedCounterValue(t *testing.T, reg *prometheus.Registry, name, resource string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, mf := range families {
		if mf.GetName() != name {
			continue
		}
		for _, m := range mf.GetMetric() {
			for _, l := range m.GetLabel() {
				if l.GetName() == "resource" && l.GetValue() == resource {
					return m.GetCounter().GetValue()
				}
			}
		}
	}
	return 0
}

// assertOnlyProcessedTrigger asserts exactly wantTrigger advanced to 1 for the
// resource, the others staying at 0.
func assertOnlyProcessedTrigger(t *testing.T, reg *prometheus.Registry, resource, wantTrigger string) {
	t.Helper()
	for _, trigger := range []string{"live", "relist", "initial"} {
		want := 0.0
		if trigger == wantTrigger {
			want = 1.0
		}
		name := "grafana_provisioning_" + trigger + "_events_processed_total"
		assert.Equal(t, want, processedCounterValue(t, reg, name, resource), "%s counter", trigger)
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
				processed:    informer.NewProcessedMetrics(reg, "repositories"),
				natsBacked:   tt.natsBacked,
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
				processed:    informer.NewProcessedMetrics(reg, "connections"),
				natsBacked:   tt.natsBacked,
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
