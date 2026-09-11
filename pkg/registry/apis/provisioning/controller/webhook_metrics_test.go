package controller

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
)

func TestWebhookSecretMetrics_NilSafe(t *testing.T) {
	var m *webhookSecretMetrics
	assert.NotPanics(t, func() {
		m.recordRotationOverdue()
		m.recordRotationError(reconcileCauseSystem)
	})
}

func TestWebhookSecretMetrics_RecordRotationOverdue(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerWebhookSecretMetrics(reg)

	m.recordRotationOverdue()
	m.recordRotationOverdue()

	assert.Equal(t, 2.0, counterValue(t, reg, "grafana_provisioning_webhook_secret_rotation_overdue_total"))
}

func TestWebhookSecretMetrics_RecordRotationError(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerWebhookSecretMetrics(reg)

	m.recordRotationError(reconcileCauseSystem)
	m.recordRotationError(reconcileCauseSystem)
	m.recordRotationError(reconcileCauseUser)

	assert.Equal(t, 2.0, counterValueWithLabel(t, reg, "grafana_provisioning_webhook_secret_rotation_errors_total", "cause", reconcileCauseSystem))
	assert.Equal(t, 1.0, counterValueWithLabel(t, reg, "grafana_provisioning_webhook_secret_rotation_errors_total", "cause", reconcileCauseUser))
}
