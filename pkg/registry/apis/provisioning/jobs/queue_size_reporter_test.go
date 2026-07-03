package jobs

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type stubQueueCounter struct {
	counts map[provisioning.JobAction]int
	err    error
}

func (s *stubQueueCounter) CountJobsByAction(_ context.Context) (map[provisioning.JobAction]int, error) {
	return s.counts, s.err
}

// gatherQueueSize returns the current queue size gauge values by action.
func gatherQueueSize(t *testing.T, registry *prometheus.Registry) map[string]float64 {
	t.Helper()

	families, err := registry.Gather()
	require.NoError(t, err)

	values := map[string]float64{}
	for _, family := range families {
		if family.GetName() != "grafana_provisioning_jobs_queue_size" {
			continue
		}
		for _, metric := range family.GetMetric() {
			require.Len(t, metric.GetLabel(), 1)
			values[metric.GetLabel()[0].GetValue()] = metric.GetGauge().GetValue()
		}
	}
	return values
}

func TestQueueSizeReporter_PreSeedsKnownActions(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	NewQueueSizeReporter(&stubQueueCounter{}, registry, time.Second)

	values := gatherQueueSize(t, registry)
	require.Len(t, values, len(knownJobActions))
	for _, action := range knownJobActions {
		assert.Zero(t, values[string(action)], "action %q should be pre-seeded to 0", action)
	}
}

func TestQueueSizeReporter_RefreshSetsCounts(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	counter := &stubQueueCounter{
		counts: map[provisioning.JobAction]int{
			provisioning.JobActionPull:      3,
			provisioning.JobActionMigrate:   1,
			provisioning.JobAction("newer"): 2, // action unknown to this build
		},
	}
	reporter := NewQueueSizeReporter(counter, registry, time.Second)

	reporter.refresh(context.Background())

	values := gatherQueueSize(t, registry)
	assert.Equal(t, float64(3), values["pull"])
	assert.Equal(t, float64(1), values["migrate"])
	assert.Equal(t, float64(2), values["newer"])
	assert.Zero(t, values["push"], "actions not in the queue stay at 0")
}

func TestQueueSizeReporter_ActionDropsToZero(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	counter := &stubQueueCounter{
		counts: map[provisioning.JobAction]int{
			provisioning.JobActionPull:      2,
			provisioning.JobAction("newer"): 1,
		},
	}
	reporter := NewQueueSizeReporter(counter, registry, time.Second)

	reporter.refresh(context.Background())
	counter.counts = map[provisioning.JobAction]int{}
	reporter.refresh(context.Background())

	values := gatherQueueSize(t, registry)
	assert.Zero(t, values["pull"])
	assert.Zero(t, values["newer"], "previously seen unknown action must drop to 0, not go stale")
}

func TestQueueSizeReporter_ErrorKeepsPreviousValues(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	counter := &stubQueueCounter{
		counts: map[provisioning.JobAction]int{provisioning.JobActionPull: 5},
	}
	reporter := NewQueueSizeReporter(counter, registry, time.Second)

	reporter.refresh(context.Background())
	counter.counts = nil
	counter.err = errors.New("list failed")
	reporter.refresh(context.Background())

	values := gatherQueueSize(t, registry)
	assert.Equal(t, float64(5), values["pull"], "failed refresh must keep the last value")
}

func TestQueueSizeReporter_RunStopsOnContextCancel(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	reporter := NewQueueSizeReporter(&stubQueueCounter{}, registry, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- reporter.Run(ctx)
	}()

	cancel()
	select {
	case err := <-done:
		assert.ErrorIs(t, err, context.Canceled)
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop after context cancellation")
	}
}
