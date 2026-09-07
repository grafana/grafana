package controller

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	repositoryQuotaAgeMetric     = "grafana_provisioning_repository_quota_age_seconds"
	repositoryQuotaChangesMetric = "grafana_provisioning_repository_quota_changes_total"
)

func TestRepositoryQuotaMetrics_ObserveAge(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := registerRepositoryQuotaMetrics(reg)

	metrics.observeAge(5 * time.Minute)
	metrics.observeAge(-time.Minute)

	family := gatherMetrics(t, reg)[repositoryQuotaAgeMetric]
	require.NotNil(t, family)
	require.Len(t, family.GetMetric(), 1)
	histogram := family.GetMetric()[0].GetHistogram()
	assert.Equal(t, uint64(2), histogram.GetSampleCount())
	assert.InDelta(t, 300, histogram.GetSampleSum(), 0.001)
}

func TestRepositoryQuotaMetrics_RecordChange(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := registerRepositoryQuotaMetrics(reg)

	metrics.recordChange()
	metrics.recordChange()

	assert.Equal(t, 2.0, counterValue(t, reg, repositoryQuotaChangesMetric))
}

func TestRepositoryQuotaMetrics_NilSafe(t *testing.T) {
	var metrics *repositoryQuotaMetrics
	assert.NotPanics(t, func() {
		metrics.observeAge(time.Minute)
		metrics.recordChange()
	})
}
