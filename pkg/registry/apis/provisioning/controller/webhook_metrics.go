package controller

import (
	"github.com/prometheus/client_golang/prometheus"
)

// webhookSecretMetrics tracks webhook-secret rotation freshness for repositories.
type webhookSecretMetrics struct {
	// rotationOverdueTotal is incremented every reconcile that observes a
	// repository webhook secret past its configured rotation interval and unable to
	// be rotated, labeled by cause. Unlike a token, a webhook secret does not
	// expire — an un-rotated secret keeps validating payloads — so there is only
	// this single "overdue" state, not a near/expired split. It is re-emitted each
	// resync while the condition holds (a stuck rotator keeps incrementing) and
	// self-resolves once the secret is rotated (a reconcile that rotates
	// successfully records nothing), mirroring the token counters.
	//
	// cause distinguishes whose problem it is, whether or not the rotation call was
	// actually made:
	//   - "system": a transient/infrastructure failure — the repository is
	//     unreachable (server unavailable/rate limited) or a rotation attempt hit an
	//     infra error. A genuine malfunction on our side.
	//   - "user": the customer must act — bad or revoked credentials, permissions,
	//     app uninstalled, invalid spec — whether that blocked rotation from being
	//     attempted or failed an attempt.
	// Alerts should page on cause="system" and route cause="user" to a
	// customer-action runbook, mirroring the token generation-error classification.
	rotationOverdueTotal *prometheus.CounterVec
}

func registerWebhookSecretMetrics(reg prometheus.Registerer) *webhookSecretMetrics {
	rotationOverdueTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_webhook_secret_rotation_overdue_total",
		Help: "Number of reconciliations that observed a repository webhook secret overdue for rotation, by cause (user/system). Re-emitted each resync while the condition holds; page on cause=\"system\".",
	}, []string{"cause"})
	reg.MustRegister(rotationOverdueTotal)

	return &webhookSecretMetrics{
		rotationOverdueTotal: rotationOverdueTotal,
	}
}

func (m *webhookSecretMetrics) recordRotationOverdue(cause string) {
	if m == nil {
		return
	}
	m.rotationOverdueTotal.WithLabelValues(cause).Inc()
}
