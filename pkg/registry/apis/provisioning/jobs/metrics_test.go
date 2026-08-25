package jobs

import (
	"errors"
	"testing"
	"time"

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

	m.RecordResourceOperation(provisioning.JobActionPull, successCreated, 0)
	m.RecordResourceOperation(provisioning.JobActionPull, successCreated, 0)
	m.RecordResourceOperation(provisioning.JobActionPull, successUpdated, 0)
	m.RecordResourceOperation(provisioning.JobActionPull, warningCreated, 0)
	m.RecordResourceOperation(provisioning.JobActionPull, errorCreated, 0)
	m.RecordResourceOperation(provisioning.JobActionPush, successDeleted, 0)

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

func TestRecordResourceOperationDuration(t *testing.T) {
	reg := testRegistry
	m := testMetrics

	// Unique group/kind so this test's series don't collide with other tests
	// sharing the singleton registry.
	const group = "durationtest.grafana.app"
	const kind = "DurationProbe"

	created := NewResourceResult().
		WithGroup(group).WithKind(kind).
		WithAction(repository.FileActionCreated).Build()
	ignored := NewResourceResult().
		WithGroup(group).WithKind(kind).
		WithAction(repository.FileActionIgnored).Build()

	m.RecordResourceOperation(provisioning.JobActionPull, created, 50*time.Millisecond)
	m.RecordResourceOperation(provisioning.JobActionPull, created, 50*time.Millisecond)
	m.RecordResourceOperation(provisioning.JobActionPull, created, 0)                   // zero duration -> not observed
	m.RecordResourceOperation(provisioning.JobActionPull, ignored, 10*time.Millisecond) // ignored op -> not observed

	metrics, err := reg.Gather()
	require.NoError(t, err)

	hist := findMetric(metrics, "grafana_provisioning_jobs_resource_operation_duration_seconds")
	require.NotNil(t, hist, "resource_operation_duration_seconds histogram should be registered")

	createdCount := histogramSampleCount(hist, map[string]string{
		"action": "pull", "operation": "created", "outcome": "success",
		"group": group, "kind": kind,
	})
	assert.Equal(t, uint64(2), createdCount, "only the two non-zero-duration created ops should be observed")

	ignoredCount := histogramSampleCount(hist, map[string]string{
		"action": "pull", "operation": "ignored", "outcome": "success",
		"group": group, "kind": kind,
	})
	assert.Equal(t, uint64(0), ignoredCount, "ignored operations must not be observed")
}

func TestRecordResourceOperationBytes(t *testing.T) {
	reg := testRegistry
	m := testMetrics

	// Unique group/kind so this test's series don't collide with other tests
	// sharing the singleton registry.
	const group = "bytestest.grafana.app"
	const kind = "ByteProbe"

	created := NewResourceResult().
		WithGroup(group).WithKind(kind).
		WithAction(repository.FileActionCreated).
		WithBytes(2048).Build()
	zeroBytes := NewResourceResult().
		WithGroup(group).WithKind(kind).
		WithAction(repository.FileActionCreated).Build() // no WithBytes -> 0
	deleted := NewResourceResult().
		WithGroup(group).WithKind(kind).
		WithAction(repository.FileActionDeleted).
		WithBytes(4096).Build() // deletes still carry no meaningful size, but exercise the real-op gate
	ignored := NewResourceResult().
		WithGroup(group).WithKind(kind).
		WithAction(repository.FileActionIgnored).
		WithBytes(4096).Build()

	m.RecordResourceOperation(provisioning.JobActionPull, created, 10*time.Millisecond)
	m.RecordResourceOperation(provisioning.JobActionPull, created, 10*time.Millisecond)
	m.RecordResourceOperation(provisioning.JobActionPull, zeroBytes, 10*time.Millisecond) // zero bytes -> not observed
	m.RecordResourceOperation(provisioning.JobActionPull, ignored, 10*time.Millisecond)   // ignored op -> not observed
	m.RecordResourceOperation(provisioning.JobActionPush, deleted, 10*time.Millisecond)

	metrics, err := reg.Gather()
	require.NoError(t, err)

	hist := findMetric(metrics, "grafana_provisioning_jobs_resource_operation_bytes")
	require.NotNil(t, hist, "resource_operation_bytes histogram should be registered")

	createdCount := histogramSampleCount(hist, map[string]string{
		"action": "pull", "operation": "created", "outcome": "success",
		"group": group, "kind": kind,
	})
	assert.Equal(t, uint64(2), createdCount, "only the two non-zero-byte created ops should be observed")

	ignoredCount := histogramSampleCount(hist, map[string]string{
		"action": "pull", "operation": "ignored", "outcome": "success",
		"group": group, "kind": kind,
	})
	assert.Equal(t, uint64(0), ignoredCount, "ignored operations must not be observed")

	deletedCount := histogramSampleCount(hist, map[string]string{
		"action": "push", "operation": "deleted", "outcome": "success",
		"group": group, "kind": kind,
	})
	assert.Equal(t, uint64(1), deletedCount, "a delete with a byte count is still a real op and observed")
}

// --- helpers ---

func histogramSampleCount(mf *dto.MetricFamily, labels map[string]string) uint64 {
	for _, m := range mf.GetMetric() {
		got := make(map[string]string)
		for _, lp := range m.GetLabel() {
			got[lp.GetName()] = lp.GetValue()
		}
		match := len(got) == len(labels)
		for k, v := range labels {
			if got[k] != v {
				match = false
				break
			}
		}
		if match {
			return m.GetHistogram().GetSampleCount()
		}
	}
	return 0
}

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
