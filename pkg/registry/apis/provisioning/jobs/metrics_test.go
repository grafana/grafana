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

func TestRecordResourceWarnings(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordResourceWarnings("pull", "MissingFolderMetadata")
	m.RecordResourceWarnings("pull", "MissingFolderMetadata")
	m.RecordResourceWarnings("pull", "ResourceInvalid")

	metrics, err := reg.Gather()
	require.NoError(t, err)

	counter := findMetric(metrics, "grafana_provisioning_jobs_resource_warnings_total")
	require.NotNil(t, counter, "resource warnings counter should be registered")

	pairs := counterValues(counter)
	require.Len(t, pairs, 2, "should have two label combinations")

	missingKey := labelKey(map[string]string{"action": "pull", "reason": "MissingFolderMetadata"})
	invalidKey := labelKey(map[string]string{"action": "pull", "reason": "ResourceInvalid"})

	assert.InDelta(t, 2.0, pairs[missingKey], 0.001, "MissingFolderMetadata should be 1+1=2")
	assert.InDelta(t, 1.0, pairs[invalidKey], 0.001, "ResourceInvalid should be 1")
}

func TestRecordResourceOperation(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordResourceOperation("pull", "replaced", "folder_metadata_id_migration", "folder.grafana.app", "Folder")
	m.RecordResourceOperation("pull", "created", "sync", "dashboard.grafana.app", "Dashboard")

	metrics, err := reg.Gather()
	require.NoError(t, err)

	counter := findMetric(metrics, "grafana_provisioning_jobs_resource_operations_total")
	require.NotNil(t, counter, "resource_operations_total counter should be registered")

	pairs := counterValues(counter)
	require.Len(t, pairs, 2)

	folderKey := labelKey(map[string]string{
		"action": "pull", "operation": "replaced",
		"reason": "folder_metadata_id_migration",
		"group":  "folder.grafana.app", "kind": "Folder",
	})
	dashKey := labelKey(map[string]string{
		"action": "pull", "operation": "created",
		"reason": "sync",
		"group":  "dashboard.grafana.app", "kind": "Dashboard",
	})

	assert.InDelta(t, 1.0, pairs[folderKey], 0.001)
	assert.InDelta(t, 1.0, pairs[dashKey], 0.001)
}

func TestRecordResourceSuccess(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordResourceSuccess("pull", "created")
	m.RecordResourceSuccess("pull", "created")
	m.RecordResourceSuccess("pull", "updated")
	m.RecordResourceSuccess("pull", "deleted")
	m.RecordResourceSuccess("pull", "noop")
	m.RecordResourceSuccess("export", "created")

	metrics, err := reg.Gather()
	require.NoError(t, err)

	counter := findMetric(metrics, "grafana_provisioning_jobs_resource_success_total")
	require.NotNil(t, counter, "resource success counter should be registered")

	pairs := counterValues(counter)
	require.Len(t, pairs, 5)

	assert.InDelta(t, 2.0, pairs[labelKey(map[string]string{"action": "pull", "operation": "created"})], 0.001)
	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{"action": "pull", "operation": "updated"})], 0.001)
	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{"action": "pull", "operation": "deleted"})], 0.001)
	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{"action": "pull", "operation": "noop"})], 0.001)
	assert.InDelta(t, 1.0, pairs[labelKey(map[string]string{"action": "export", "operation": "created"})], 0.001)
}

func TestRecordResourceErrors(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordResourceErrors("pull")
	m.RecordResourceErrors("pull")
	m.RecordResourceErrors("pull")
	m.RecordResourceErrors("export")

	metrics, err := reg.Gather()
	require.NoError(t, err)

	counter := findMetric(metrics, "grafana_provisioning_jobs_resource_errors_total")
	require.NotNil(t, counter, "resource errors counter should be registered")

	pairs := counterValues(counter)
	require.Len(t, pairs, 2, "should have two label combinations")

	pullKey := labelKey(map[string]string{"action": "pull"})
	exportKey := labelKey(map[string]string{"action": "export"})

	assert.InDelta(t, 3.0, pairs[pullKey], 0.001, "pull should be 3")
	assert.InDelta(t, 1.0, pairs[exportKey], 0.001, "export should be 1")
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
