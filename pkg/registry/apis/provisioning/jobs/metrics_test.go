package jobs

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisterJobMetrics(t *testing.T) {
	t.Run("does not panic on pedantic registry", func(t *testing.T) {
		require.NotPanics(t, func() {
			RegisterJobMetrics(prometheus.NewPedanticRegistry())
		})
	})

	t.Run("double registration panics", func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()
		RegisterJobMetrics(reg)
		require.Panics(t, func() {
			RegisterJobMetrics(reg)
		})
	})
}

func TestRecordResourceOperation(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordResourceOperation("pull", OperationCreated, OutcomeSuccess, "", "dashboard.grafana.app", "Dashboard")
	m.RecordResourceOperation("pull", OperationCreated, OutcomeSuccess, "", "dashboard.grafana.app", "Dashboard")
	m.RecordResourceOperation("pull", OperationUpdated, OutcomeSuccess, "", "folder.grafana.app", "Folder")
	m.RecordResourceOperation("pull", OperationCreated, OutcomeWarning, "MissingFolderMetadata", "folder.grafana.app", "Folder")
	m.RecordResourceOperation("pull", OperationCreated, OutcomeError, "", "dashboard.grafana.app", "Dashboard")
	m.RecordResourceOperation("export", OperationDeleted, OutcomeSuccess, "", "dashboard.grafana.app", "Dashboard")

	metrics, err := reg.Gather()
	require.NoError(t, err)

	counter := findMetric(metrics, "grafana_provisioning_jobs_resource_operations_total")
	require.NotNil(t, counter, "resource_operations_total counter should be registered")

	pairs := counterValues(counter)
	require.Len(t, pairs, 5)

	assert.InDelta(t, 2.0, pairs[labelKey(map[string]string{
		"action": "pull", "operation": "created", "outcome": "success",
		"reason": "", "group": "dashboard.grafana.app", "kind": "Dashboard",
	})], 0.001, "pull/created/success/Dashboard should be 2")

	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{
		"action": "pull", "operation": "updated", "outcome": "success",
		"reason": "", "group": "folder.grafana.app", "kind": "Folder",
	})], 0.001)

	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{
		"action": "pull", "operation": "created", "outcome": "warning",
		"reason": "MissingFolderMetadata", "group": "folder.grafana.app", "kind": "Folder",
	})], 0.001)

	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{
		"action": "pull", "operation": "created", "outcome": "error",
		"reason": "", "group": "dashboard.grafana.app", "kind": "Dashboard",
	})], 0.001)

	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{
		"action": "export", "operation": "deleted", "outcome": "success",
		"reason": "", "group": "dashboard.grafana.app", "kind": "Dashboard",
	})], 0.001)
}

// --- helpers ---

func findMetric(families []*dto.MetricFamily, name string) *dto.MetricFamily {
	for _, mf := range families {
		if mf.GetName() == name {
			return mf
		}
	}
	return nil
}

func counterValues(mf *dto.MetricFamily) map[string]float64 {
	out := make(map[string]float64)
	for _, m := range mf.GetMetric() {
		labels := make(map[string]string)
		for _, lp := range m.GetLabel() {
			labels[lp.GetName()] = lp.GetValue()
		}
		out[labelKey(labels)] = m.GetCounter().GetValue()
	}
	return out
}

func labelKey(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	// Sort to get deterministic keys
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j] < keys[j-1]; j-- {
			keys[j], keys[j-1] = keys[j-1], keys[j]
		}
	}
	s := ""
	for _, k := range keys {
		if s != "" {
			s += ","
		}
		s += k + "=" + labels[k]
	}
	return s
}
