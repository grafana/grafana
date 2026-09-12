package controller

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
)

func TestWebhookSecretMetrics_NilSafe(t *testing.T) {
	var m *webhookSecretMetrics
	assert.NotPanics(t, func() {
		m.recordRotationOverdue(rotationCauseBlocked)
	})
}

func TestWebhookSecretMetrics_RecordRotationOverdue(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerWebhookSecretMetrics(reg)

	m.recordRotationOverdue(rotationCauseBlocked)
	m.recordRotationOverdue(rotationCauseBlocked)
	m.recordRotationOverdue(reconcileCauseSystem)
	m.recordRotationOverdue(reconcileCauseUser)

	metric := "grafana_provisioning_webhook_secret_rotation_overdue_total"
	assert.Equal(t, 2.0, counterValueWithLabel(t, reg, metric, "cause", rotationCauseBlocked))
	assert.Equal(t, 1.0, counterValueWithLabel(t, reg, metric, "cause", reconcileCauseSystem))
	assert.Equal(t, 1.0, counterValueWithLabel(t, reg, metric, "cause", reconcileCauseUser))
}
