package controller

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConnectionTokenMetrics_NilSafe(t *testing.T) {
	var m *connectionTokenMetrics
	assert.NotPanics(t, func() {
		m.recordGeneration(0.5)
		m.recordGenerationError()
		m.recordRefreshReason(refreshReasonMissing)
		m.recordTimeToExpiry(300)
	})
}

func TestRepositoryTokenMetrics_NilSafe(t *testing.T) {
	var m *repositoryTokenMetrics
	assert.NotPanics(t, func() {
		m.recordGeneration(0.5)
		m.recordGenerationError()
		m.recordRefreshReason(refreshReasonExpiring)
		m.recordTimeToExpiry(300)
	})
}

func TestConnectionTokenMetrics_RecordGeneration(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerConnectionTokenMetrics(reg)

	m.recordGeneration(0.123)
	m.recordGeneration(0.456)

	val := counterValue(t, reg, "grafana_provisioning_connection_token_generated_total")
	assert.Equal(t, 2.0, val)

	count := histogramCount(t, reg, "grafana_provisioning_connection_token_generated_duration_seconds")
	assert.Equal(t, uint64(2), count)
}

func TestConnectionTokenMetrics_RecordGenerationError(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerConnectionTokenMetrics(reg)

	m.recordGenerationError()

	val := counterValue(t, reg, "grafana_provisioning_connection_token_generation_errors_total")
	assert.Equal(t, 1.0, val)
}

func TestConnectionTokenMetrics_RecordRefreshReason(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerConnectionTokenMetrics(reg)

	m.recordRefreshReason(refreshReasonMissing)
	m.recordRefreshReason(refreshReasonInvalid)
	m.recordRefreshReason(refreshReasonExpiring)
	m.recordRefreshReason(refreshReasonExpiring)

	families := gatherMetrics(t, reg)
	family := families["grafana_provisioning_connection_token_refresh_reason_total"]
	require.NotNil(t, family)

	byReason := map[string]float64{}
	for _, metric := range family.GetMetric() {
		for _, lp := range metric.GetLabel() {
			if lp.GetName() == "reason" {
				byReason[lp.GetValue()] = metric.GetCounter().GetValue()
			}
		}
	}
	assert.Equal(t, 1.0, byReason["missing"])
	assert.Equal(t, 1.0, byReason["invalid"])
	assert.Equal(t, 2.0, byReason["expiring"])
}

func TestConnectionTokenMetrics_RecordTimeToExpiry(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerConnectionTokenMetrics(reg)

	m.recordTimeToExpiry(120)
	m.recordTimeToExpiry(-10) // negative clamped to 0

	count := histogramCount(t, reg, "grafana_provisioning_connection_token_time_to_expiry_seconds")
	assert.Equal(t, uint64(2), count)
}

func TestRepositoryTokenMetrics_RecordGeneration(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerRepositoryTokenMetrics(reg)

	m.recordGeneration(0.789)

	val := counterValue(t, reg, "grafana_provisioning_repository_token_generated_total")
	assert.Equal(t, 1.0, val)

	count := histogramCount(t, reg, "grafana_provisioning_repository_token_generated_duration_seconds")
	assert.Equal(t, uint64(1), count)
}

func TestRepositoryTokenMetrics_RecordGenerationError(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerRepositoryTokenMetrics(reg)

	m.recordGenerationError()
	m.recordGenerationError()

	val := counterValue(t, reg, "grafana_provisioning_repository_token_generation_errors_total")
	assert.Equal(t, 2.0, val)
}

func TestRepositoryTokenMetrics_RecordRefreshReason(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerRepositoryTokenMetrics(reg)

	m.recordRefreshReason(refreshReasonMissing)
	m.recordRefreshReason(refreshReasonExpiring)

	families := gatherMetrics(t, reg)
	family := families["grafana_provisioning_repository_token_refresh_reason_total"]
	require.NotNil(t, family)

	byReason := map[string]float64{}
	for _, metric := range family.GetMetric() {
		for _, lp := range metric.GetLabel() {
			if lp.GetName() == "reason" {
				byReason[lp.GetValue()] = metric.GetCounter().GetValue()
			}
		}
	}
	assert.Equal(t, 1.0, byReason["missing"])
	assert.Equal(t, 1.0, byReason["expiring"])
}

func TestRepositoryTokenMetrics_RecordTimeToExpiry(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerRepositoryTokenMetrics(reg)

	m.recordTimeToExpiry(600)

	count := histogramCount(t, reg, "grafana_provisioning_repository_token_time_to_expiry_seconds")
	assert.Equal(t, uint64(1), count)
}

// helpers

func gatherMetrics(t *testing.T, reg *prometheus.Registry) map[string]*dto.MetricFamily {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	m := make(map[string]*dto.MetricFamily, len(families))
	for _, f := range families {
		m[f.GetName()] = f
	}
	return m
}

func counterValue(t *testing.T, reg *prometheus.Registry, name string) float64 {
	t.Helper()
	families := gatherMetrics(t, reg)
	f, ok := families[name]
	require.True(t, ok, "metric %s not found", name)
	require.NotEmpty(t, f.GetMetric())
	return f.GetMetric()[0].GetCounter().GetValue()
}

func histogramCount(t *testing.T, reg *prometheus.Registry, name string) uint64 {
	t.Helper()
	families := gatherMetrics(t, reg)
	f, ok := families[name]
	require.True(t, ok, "metric %s not found", name)
	require.NotEmpty(t, f.GetMetric())
	return f.GetMetric()[0].GetHistogram().GetSampleCount()
}
