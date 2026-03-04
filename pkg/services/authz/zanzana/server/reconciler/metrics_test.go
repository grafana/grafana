package reconciler

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewReconcilerMetrics_Registration(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := newReconcilerMetrics(reg)
	require.NotNil(t, m)

	// Vec metrics only appear in Gather after first use; touch each to materialise them.
	m.namespaceDurationSeconds.WithLabelValues("success").Observe(0)
	m.tuplesWrittenTotal.WithLabelValues("add").Add(0)

	gathered, err := reg.Gather()
	require.NoError(t, err)

	names := make([]string, 0, len(gathered))
	for _, mf := range gathered {
		names = append(names, mf.GetName())
	}

	assert.Contains(t, names, "iam_authz_zanzana_reconciler_namespace_reconcile_duration_seconds")
	assert.Contains(t, names, "iam_authz_zanzana_reconciler_work_queue_depth")
	assert.Contains(t, names, "iam_authz_zanzana_reconciler_tuples_written_total")
}

func TestReconcilerMetrics_WorkQueueDepth(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := newReconcilerMetrics(reg)

	assert.Equal(t, float64(0), testutil.ToFloat64(m.workQueueDepth))

	m.workQueueDepth.Inc()
	m.workQueueDepth.Inc()
	m.workQueueDepth.Inc()
	assert.Equal(t, float64(3), testutil.ToFloat64(m.workQueueDepth))

	m.workQueueDepth.Dec()
	assert.Equal(t, float64(2), testutil.ToFloat64(m.workQueueDepth))
}

func TestReconcilerMetrics_TuplesWrittenTotal(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := newReconcilerMetrics(reg)

	assert.Equal(t, float64(0), testutil.ToFloat64(m.tuplesWrittenTotal.WithLabelValues("add")))
	assert.Equal(t, float64(0), testutil.ToFloat64(m.tuplesWrittenTotal.WithLabelValues("delete")))

	m.tuplesWrittenTotal.WithLabelValues("add").Add(42)
	m.tuplesWrittenTotal.WithLabelValues("delete").Add(7)

	assert.Equal(t, float64(42), testutil.ToFloat64(m.tuplesWrittenTotal.WithLabelValues("add")))
	assert.Equal(t, float64(7), testutil.ToFloat64(m.tuplesWrittenTotal.WithLabelValues("delete")))
}

func TestReconcilerMetrics_NamespaceDuration(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := newReconcilerMetrics(reg)

	m.namespaceDurationSeconds.WithLabelValues("success").Observe(0.5)
	m.namespaceDurationSeconds.WithLabelValues("success").Observe(1.5)
	m.namespaceDurationSeconds.WithLabelValues("error").Observe(0.1)

	// HistogramVec.WithLabelValues returns Observer, not Collector, so we gather and inspect.
	gathered, err := reg.Gather()
	require.NoError(t, err)

	counts := make(map[string]uint64)
	for _, mf := range gathered {
		if mf.GetName() == "iam_authz_zanzana_reconciler_namespace_reconcile_duration_seconds" {
			for _, m := range mf.GetMetric() {
				for _, lp := range m.GetLabel() {
					if lp.GetName() == "status" {
						counts[lp.GetValue()] = m.GetHistogram().GetSampleCount()
					}
				}
			}
		}
	}
	assert.Equal(t, uint64(2), counts["success"])
	assert.Equal(t, uint64(1), counts["error"])
}

func TestNewReconcilerMetrics_MetricDescriptions(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := newReconcilerMetrics(reg)

	// Touch Vec metrics so they appear in Gather.
	m.namespaceDurationSeconds.WithLabelValues("success").Observe(0)
	m.tuplesWrittenTotal.WithLabelValues("add").Add(0)

	gathered, err := reg.Gather()
	require.NoError(t, err)

	helpByName := make(map[string]string, len(gathered))
	for _, mf := range gathered {
		helpByName[mf.GetName()] = mf.GetHelp()
	}

	assert.True(t, strings.Contains(helpByName["iam_authz_zanzana_reconciler_namespace_reconcile_duration_seconds"], "reconciliation"))
	assert.True(t, strings.Contains(helpByName["iam_authz_zanzana_reconciler_work_queue_depth"], "queue"))
	assert.True(t, strings.Contains(helpByName["iam_authz_zanzana_reconciler_tuples_written_total"], "tuples"))
}

func TestNewReconcilerMetrics_DoubleRegistration(t *testing.T) {
	// Registering twice on the same registry should panic (promauto behaviour).
	// This test guards against accidental global registration.
	reg := prometheus.NewRegistry()
	newReconcilerMetrics(reg)
	assert.Panics(t, func() { newReconcilerMetrics(reg) })
}
