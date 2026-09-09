package controller

import (
	"github.com/prometheus/client_golang/prometheus"
)

// webhookSecretMetrics tracks webhook-secret rotation freshness for repositories.
type webhookSecretMetrics struct {
	// rotationOverdueTotal is incremented every reconcile that observes a
	// repository webhook secret past its configured rotation interval. Unlike a
	// token, a webhook secret does not expire — an un-rotated secret keeps
	// validating payloads — so there is only this single "overdue" state, not a
	// near/expired split. It is re-emitted each resync while the condition holds
	// (a stuck rotator keeps incrementing) and self-resolves once the secret is
	// rotated, mirroring the token counters.
	rotationOverdueTotal prometheus.Counter
}

func registerWebhookSecretMetrics(reg prometheus.Registerer) *webhookSecretMetrics {
	rotationOverdueTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_webhook_secret_rotation_overdue_total",
		Help: "Number of reconciliations that observed a repository webhook secret overdue for rotation (re-emitted each resync while the condition holds)",
	})
	reg.MustRegister(rotationOverdueTotal)

	return &webhookSecretMetrics{
		rotationOverdueTotal: rotationOverdueTotal,
	}
}

func (m *webhookSecretMetrics) recordRotationOverdue() {
	if m == nil {
		return
	}
	m.rotationOverdueTotal.Inc()
}
