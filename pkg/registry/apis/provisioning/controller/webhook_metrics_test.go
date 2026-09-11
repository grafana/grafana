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
	})
}

func TestWebhookSecretMetrics_RecordRotationOverdue(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := registerWebhookSecretMetrics(reg)

	m.recordRotationOverdue()
	m.recordRotationOverdue()

	assert.Equal(t, 2.0, counterValue(t, reg, "grafana_provisioning_webhook_secret_rotation_overdue_total"))
}
