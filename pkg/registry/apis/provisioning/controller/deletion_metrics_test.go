package controller

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	repositoryDeletionPendingMetric = "grafana_provisioning_repository_deletion_pending_seconds"
	repositoryDeletionsMetric       = "grafana_provisioning_repository_deletions_total"
	repositoryDeletionErrorsMetric  = "grafana_provisioning_repository_deletion_errors_total"
)

func TestRepositoryDeletionMetrics_ObservePending(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := registerRepositoryDeletionMetrics(reg)

	metrics.observePending(90 * time.Minute)
	metrics.observePending(-time.Minute) // clamped to 0

	family := gatherMetrics(t, reg)[repositoryDeletionPendingMetric]
	require.NotNil(t, family)
	require.Len(t, family.GetMetric(), 1)
	histogram := family.GetMetric()[0].GetHistogram()
	assert.Equal(t, uint64(2), histogram.GetSampleCount())
	assert.InDelta(t, (90 * time.Minute).Seconds(), histogram.GetSampleSum(), 0.001)
}

func TestRepositoryDeletionMetrics_RecordDeletion(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := registerRepositoryDeletionMetrics(reg)

	metrics.recordDeletion()
	metrics.recordDeletion()

	assert.Equal(t, 2.0, counterValue(t, reg, repositoryDeletionsMetric))
}

func TestRepositoryDeletionMetrics_RecordError(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := registerRepositoryDeletionMetrics(reg)

	metrics.recordError(deletionStageFinalizers)
	metrics.recordError(deletionStageRemoveFinalizers)
	metrics.recordError(deletionStageRemoveFinalizers)

	assert.Equal(t, 1.0, deletionErrorsByStage(t, reg, deletionStageFinalizers))
	assert.Equal(t, 2.0, deletionErrorsByStage(t, reg, deletionStageRemoveFinalizers))
}

func TestRepositoryDeletionMetrics_NilSafe(t *testing.T) {
	var metrics *repositoryDeletionMetrics
	assert.NotPanics(t, func() {
		metrics.observePending(time.Minute)
		metrics.recordDeletion()
		metrics.recordError(deletionStageFinalizers)
	})
}

func deletionErrorsByStage(t *testing.T, reg *prometheus.Registry, stage string) float64 {
	t.Helper()
	f, ok := gatherMetrics(t, reg)[repositoryDeletionErrorsMetric]
	require.True(t, ok, "metric %s not found", repositoryDeletionErrorsMetric)
	for _, m := range f.GetMetric() {
		for _, l := range m.GetLabel() {
			if l.GetName() == "stage" && l.GetValue() == stage {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}
