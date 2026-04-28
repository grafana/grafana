package jobs

import (
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Shared registry for all tests to work with sync.Once singleton pattern
var testRegistry = prometheus.NewRegistry()
var testMetrics = RegisterJobMetrics(testRegistry)

func TestRegisterJobMetrics(t *testing.T) {
	t.Run("does not panic on pedantic registry", func(t *testing.T) {
		require.NotPanics(t, func() {
			// This will use the singleton, won't actually register with the new registry
			RegisterJobMetrics(prometheus.NewPedanticRegistry())
		})
	})

	t.Run("double registration is safe with sync.Once", func(t *testing.T) {
		// Use the shared registry
		RegisterJobMetrics(testRegistry)
		// Should not panic - sync.Once prevents double registration
		require.NotPanics(t, func() {
			RegisterJobMetrics(testRegistry)
		})
	})
}

func TestRecordResourceOperation(t *testing.T) {
	// Use the shared registry and metrics
	reg := testRegistry
	m := testMetrics

	successCreated := NewResourceResult().
		WithGroup("dashboard.grafana.app").WithKind("Dashboard").
		WithAction(repository.FileActionCreated).Build()
	successUpdated := NewResourceResult().
		WithGroup("folder.grafana.app").WithKind("Folder").
		WithAction(repository.FileActionUpdated).Build()
	warningCreated := NewResourceResult().
		WithGroup("folder.grafana.app").WithKind("Folder").
		WithAction(repository.FileActionCreated).
		WithError(resources.NewMissingFolderMetadata("folders/a")).Build()
	errorCreated := NewResourceResult().
		WithGroup("dashboard.grafana.app").WithKind("Dashboard").
		WithAction(repository.FileActionCreated).
		WithError(errors.New("network failure")).Build()
	successDeleted := NewResourceResult().
		WithGroup("dashboard.grafana.app").WithKind("Dashboard").
		WithAction(repository.FileActionDeleted).Build()

	m.RecordResourceOperation(provisioning.JobActionPull, successCreated)
	m.RecordResourceOperation(provisioning.JobActionPull, successCreated)
	m.RecordResourceOperation(provisioning.JobActionPull, successUpdated)
	m.RecordResourceOperation(provisioning.JobActionPull, warningCreated)
	m.RecordResourceOperation(provisioning.JobActionPull, errorCreated)
	m.RecordResourceOperation(provisioning.JobActionPush, successDeleted)

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
		"action": "push", "operation": "deleted", "outcome": "success",
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
