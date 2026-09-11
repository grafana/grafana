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
	//
	// It is deliberately unlabeled by cause: overdue is derived from the persisted
	// status.webhook.lastRotated timestamp, not from a live rotation attempt, so
	// the reason it stayed overdue is not known here. Notably a rotation is only
	// attempted while the repository is accessible, so a repo stuck unauthenticated
	// stays perpetually overdue without ever incrementing rotationErrorsTotal.
	// Correlate with rotationErrorsTotal's cause label to distinguish "overdue
	// because rotation can't run (e.g. auth broken)" from a genuine rotation
	// malfunction.
	rotationOverdueTotal prometheus.Counter
	// rotationErrorsTotal counts webhook secret rotation attempts that failed,
	// labeled by cause. "user" means the customer must act (revoked credentials,
	// app uninstalled); "system" covers transient/infrastructure failures that are
	// safe to retry. Alerts should page on cause="system" and route cause="user"
	// to a customer-action runbook, mirroring the token generation-error counters.
	rotationErrorsTotal *prometheus.CounterVec
}

func registerWebhookSecretMetrics(reg prometheus.Registerer) *webhookSecretMetrics {
	rotationOverdueTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_webhook_secret_rotation_overdue_total",
		Help: "Number of reconciliations that observed a repository webhook secret overdue for rotation (re-emitted each resync while the condition holds)",
	})
	reg.MustRegister(rotationOverdueTotal)

	rotationErrorsTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_webhook_secret_rotation_errors_total",
		Help: "Total number of webhook secret rotation errors by cause. Filter cause!=\"user\" to exclude user-caused failures (e.g. revoked credentials, app uninstalled) from SLOs.",
	}, []string{"cause"})
	reg.MustRegister(rotationErrorsTotal)

	return &webhookSecretMetrics{
		rotationOverdueTotal: rotationOverdueTotal,
		rotationErrorsTotal:  rotationErrorsTotal,
	}
}

func (m *webhookSecretMetrics) recordRotationOverdue() {
	if m == nil {
		return
	}
	m.rotationOverdueTotal.Inc()
}

func (m *webhookSecretMetrics) recordRotationError(cause string) {
	if m == nil {
		return
	}
	m.rotationErrorsTotal.WithLabelValues(cause).Inc()
}
