package controller

import (
	"github.com/prometheus/client_golang/prometheus"
)

// rotationCauseBlocked labels an overdue observation where rotation could not be
// attempted this reconcile (the repository is inaccessible or in the hook-failure
// cooldown), as opposed to reconcileCauseUser/reconcileCauseSystem which label an
// overdue observation where rotation was attempted and failed.
const rotationCauseBlocked = "blocked"

// webhookSecretMetrics tracks webhook-secret rotation freshness for repositories.
type webhookSecretMetrics struct {
	// rotationOverdueTotal is incremented every reconcile that observes a
	// repository webhook secret past its configured rotation interval and unable to
	// be rotated, labeled by why it stayed overdue. Unlike a token, a webhook secret
	// does not expire — an un-rotated secret keeps validating payloads — so there is
	// only this single "overdue" state, not a near/expired split. It is re-emitted
	// each resync while the condition holds (a stuck rotator keeps incrementing) and
	// self-resolves once the secret is rotated (a reconcile that rotates
	// successfully records nothing), mirroring the token counters.
	//
	// cause distinguishes why the secret remains overdue:
	//   - "blocked": rotation could not be attempted — the repository is
	//     inaccessible (e.g. auth broken) or in the hook-failure cooldown. This is
	//     usually user-actionable (fix credentials); correlate with the repository's
	//     health/readyReason for the underlying reason, which may instead be a
	//     transient server outage.
	//   - "user": rotation was attempted and failed with a user-caused error
	//     (revoked credentials, app uninstalled).
	//   - "system": rotation was attempted and failed with a transient/infrastructure
	//     error — a genuine rotation malfunction.
	// Alerts should page on cause="system" and route cause="blocked"/"user" to a
	// customer-action runbook, mirroring the token generation-error classification.
	rotationOverdueTotal *prometheus.CounterVec
}

func registerWebhookSecretMetrics(reg prometheus.Registerer) *webhookSecretMetrics {
	rotationOverdueTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_webhook_secret_rotation_overdue_total",
		Help: "Number of reconciliations that observed a repository webhook secret overdue for rotation, by cause (blocked/user/system). Re-emitted each resync while the condition holds; page on cause=\"system\".",
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
