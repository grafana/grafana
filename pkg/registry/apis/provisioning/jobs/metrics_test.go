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

func TestRecordWarnings(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordWarnings("pull", "MissingFolderMetadata", 5)
	m.RecordWarnings("pull", "MissingFolderMetadata", 3)
	m.RecordWarnings("pull", "ResourceInvalid", 1)

	metrics, err := reg.Gather()
	require.NoError(t, err)

	hist := findMetric(metrics, "grafana_provisioning_jobs_warnings")
	require.NotNil(t, hist, "warnings histogram should be registered")

	pairs := histogramSamples(hist)
	require.Len(t, pairs, 2, "should have two label combinations")

	missingKey := labelKey(map[string]string{"action": "pull", "reason": "MissingFolderMetadata"})
	invalidKey := labelKey(map[string]string{"action": "pull", "reason": "ResourceInvalid"})

	assert.Equal(t, uint64(2), pairs[missingKey].count, "MissingFolderMetadata should have 2 observations")
	assert.InDelta(t, 8.0, pairs[missingKey].sum, 0.001, "MissingFolderMetadata sum should be 5+3=8")
	assert.Equal(t, uint64(1), pairs[invalidKey].count, "ResourceInvalid should have 1 observation")
	assert.InDelta(t, 1.0, pairs[invalidKey].sum, 0.001, "ResourceInvalid sum should be 1")
}

func TestRecordFileOperation(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordFileOperation("pull", "created", "folder_metadata")
	m.RecordFileOperation("pull", "created", "folder_metadata")
	m.RecordFileOperation("export", "updated", "folder_metadata")

	metrics, err := reg.Gather()
	require.NoError(t, err)

	counter := findMetric(metrics, "grafana_provisioning_jobs_file_operations_total")
	require.NotNil(t, counter, "file_operations_total counter should be registered")

	pairs := counterValues(counter)
	require.Len(t, pairs, 2)

	pullCreated := labelKey(map[string]string{"action": "pull", "operation": "created", "reason": "folder_metadata"})
	exportUpdated := labelKey(map[string]string{"action": "export", "operation": "updated", "reason": "folder_metadata"})

	assert.InDelta(t, 2.0, pairs[pullCreated], 0.001)
	assert.InDelta(t, 1.0, pairs[exportUpdated], 0.001)
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
		"group": "folder.grafana.app", "kind": "Folder",
	})
	dashKey := labelKey(map[string]string{
		"action": "pull", "operation": "created",
		"reason": "sync",
		"group": "dashboard.grafana.app", "kind": "Dashboard",
	})

	assert.InDelta(t, 1.0, pairs[folderKey], 0.001)
	assert.InDelta(t, 1.0, pairs[dashKey], 0.001)
}

func TestRecordErrors(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := RegisterJobMetrics(reg)

	m.RecordErrors("pull", 7)
	m.RecordErrors("pull", 3)
	m.RecordErrors("export", 0)

	metrics, err := reg.Gather()
	require.NoError(t, err)

	hist := findMetric(metrics, "grafana_provisioning_jobs_errors")
	require.NotNil(t, hist, "errors histogram should be registered")

	pairs := histogramSamples(hist)
	require.Len(t, pairs, 2, "should have two label combinations")

	pullKey := labelKey(map[string]string{"action": "pull"})
	exportKey := labelKey(map[string]string{"action": "export"})

	assert.Equal(t, uint64(2), pairs[pullKey].count, "pull should have 2 observations")
	assert.InDelta(t, 10.0, pairs[pullKey].sum, 0.001, "pull sum should be 7+3=10")
	assert.Equal(t, uint64(1), pairs[exportKey].count, "export should have 1 observation")
	assert.InDelta(t, 0.0, pairs[exportKey].sum, 0.001, "export sum should be 0")
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

type histSample struct {
	count uint64
	sum   float64
}

func histogramSamples(mf *dto.MetricFamily) map[string]histSample {
	out := make(map[string]histSample)
	for _, m := range mf.GetMetric() {
		labels := make(map[string]string)
		for _, lp := range m.GetLabel() {
			labels[lp.GetName()] = lp.GetValue()
		}
		out[labelKey(labels)] = histSample{
			count: m.GetHistogram().GetSampleCount(),
			sum:   m.GetHistogram().GetSampleSum(),
		}
	}
	return out
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
