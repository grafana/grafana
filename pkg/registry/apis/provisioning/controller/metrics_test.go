package controller

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReconcileErrorMetrics_NilSafe(t *testing.T) {
	var metrics *reconcileErrorMetrics
	assert.NotPanics(t, func() {
		metrics.RecordReconcileError(reconcilePhaseDelete, reconcileCauseUser)
	})
}

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

// gaugeValueByName reads the single-sample gauge `name` from the gatherer.
func gaugeValueByName(t *testing.T, g prometheus.Gatherer, name string) float64 {
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

// histogramSampleCountByName reads the observation count of the histogram `name`.
func histogramSampleCountByName(t *testing.T, g prometheus.Gatherer, name string) uint64 {
	t.Helper()
	mfs, err := g.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() == name {
			require.Len(t, mf.GetMetric(), 1)
			return mf.GetMetric()[0].GetHistogram().GetSampleCount()
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0
}
