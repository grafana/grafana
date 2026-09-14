package controller

import (
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestConnectionTokenMetrics_NilSafe(t *testing.T) {
	var m *connectionTokenMetrics
	assert.NotPanics(t, func() {
		m.recordGeneration(0.5)
		m.recordGenerationError(reconcileCauseSystem)
		m.recordRefreshReason(refreshReasonMissing)
		m.recordTimeToExpiry(300)
		m.recordExpired()
	})
}

func TestConnectionTokenMetrics_RecordExpired(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerConnectionTokenMetrics(reg)

	m.recordExpired()

	assert.Equal(t, 1.0, counterValue(t, reg, "grafana_provisioning_connection_tokens_expired_total"))
}

func TestRepositoryTokenMetrics_NilSafe(t *testing.T) {
	var m *repositoryTokenMetrics
	assert.NotPanics(t, func() {
		m.recordGeneration(0.5)
		m.recordGenerationError(reconcileCauseSystem)
		m.recordRefreshReason(refreshReasonExpiring)
		m.recordTimeToExpiry(300)
		m.recordExpired()
	})
}

func TestRepositoryTokenMetrics_RecordExpired(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerRepositoryTokenMetrics(reg)

	m.recordExpired()
	m.recordExpired()

	assert.Equal(t, 2.0, counterValue(t, reg, "grafana_provisioning_repository_tokens_expired_total"))
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

	m.recordGenerationError(reconcileCauseUser)
	m.recordGenerationError(reconcileCauseSystem)
	m.recordGenerationError(reconcileCauseSystem)

	const name = "grafana_provisioning_connection_token_generation_errors_total"
	assert.Equal(t, 1.0, counterValueWithLabel(t, reg, name, "cause", reconcileCauseUser))
	assert.Equal(t, 2.0, counterValueWithLabel(t, reg, name, "cause", reconcileCauseSystem))
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

	m.recordGenerationError(reconcileCauseUser)
	m.recordGenerationError(reconcileCauseUser)
	m.recordGenerationError(reconcileCauseSystem)

	const name = "grafana_provisioning_repository_token_generation_errors_total"
	assert.Equal(t, 2.0, counterValueWithLabel(t, reg, name, "cause", reconcileCauseUser))
	assert.Equal(t, 1.0, counterValueWithLabel(t, reg, name, "cause", reconcileCauseSystem))
}

func TestClassifyTokenErrorCause(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"nil error", nil, reconcileCauseSystem},
		{"authentication (app uninstalled / perms revoked)", connection.ErrAuthentication, reconcileCauseUser},
		{"not found (installation gone)", connection.ErrNotFound, reconcileCauseUser},
		{"repository access (repo not selected)", connection.ErrRepositoryAccess, reconcileCauseUser},
		{"repository unauthorized", repository.ErrUnauthorized, reconcileCauseUser},
		{"repository permission denied", repository.ErrPermissionDenied, reconcileCauseUser},
		{"wrapped authentication", fmt.Errorf("unable to create token for repository: %w", connection.ErrAuthentication), reconcileCauseUser},
		{"github service unavailable", github.ErrServiceUnavailable, reconcileCauseSystem},
		{"transient/other", errors.New("connection reset by peer"), reconcileCauseSystem},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, classifyTokenErrorCause(tt.err))
		})
	}
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

func counterValueWithLabel(t *testing.T, reg *prometheus.Registry, name, labelName, labelValue string) float64 {
	t.Helper()
	families := gatherMetrics(t, reg)
	f, ok := families[name]
	require.True(t, ok, "metric %s not found", name)
	for _, metric := range f.GetMetric() {
		for _, lp := range metric.GetLabel() {
			if lp.GetName() == labelName && lp.GetValue() == labelValue {
				return metric.GetCounter().GetValue()
			}
		}
	}
	return 0
}

func histogramCount(t *testing.T, reg *prometheus.Registry, name string) uint64 {
	t.Helper()
	families := gatherMetrics(t, reg)
	f, ok := families[name]
	require.True(t, ok, "metric %s not found", name)
	require.NotEmpty(t, f.GetMetric())
	return f.GetMetric()[0].GetHistogram().GetSampleCount()
}
