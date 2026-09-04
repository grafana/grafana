package controller

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const repositoryQuotaStalenessMetric = "grafana_provisioning_repository_quota_staleness_seconds"

func TestRepositoryQuotaMetrics_ObserveStaleness(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := registerRepositoryQuotaMetrics(reg)

	metrics.observeStaleness(5 * time.Minute)
	metrics.observeStaleness(-time.Minute)

	family := gatherMetrics(t, reg)[repositoryQuotaStalenessMetric]
	require.NotNil(t, family)
	require.Len(t, family.GetMetric(), 1)
	histogram := family.GetMetric()[0].GetHistogram()
	assert.Equal(t, uint64(2), histogram.GetSampleCount())
	assert.InDelta(t, 300, histogram.GetSampleSum(), 0.001)
}

func TestRepositoryQuotaMetrics_NilSafe(t *testing.T) {
	var metrics *repositoryQuotaMetrics
	assert.NotPanics(t, func() {
		metrics.observeStaleness(time.Minute)
	})
}
