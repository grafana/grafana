package controller

import (
	"errors"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type refreshReason string

const (
	refreshReasonMissing  refreshReason = "missing"
	refreshReasonInvalid  refreshReason = "invalid"
	refreshReasonExpiring refreshReason = "expiring"
)

// classifyTokenErrorCause maps a token generation/refresh failure to a cause
// label. "user" means the customer must act (GitHub App uninstalled or
// suspended, permissions revoked, installation gone, repository not selected);
// "system" covers transient/infrastructure failures that are safe to retry.
// Alerts should page on cause="system" and route cause="user" to a
// customer-action runbook. The token path surfaces connection-level sentinels
// while other reconcile paths use repository-level ones, so both are matched
// here to keep classification consistent across metrics.
func classifyTokenErrorCause(err error) string {
	switch {
	case errors.Is(err, connection.ErrAuthentication),
		errors.Is(err, connection.ErrNotFound),
		errors.Is(err, connection.ErrRepositoryAccess),
		errors.Is(err, repository.ErrUnauthorized),
		errors.Is(err, repository.ErrPermissionDenied):
		return reconcileCauseUser
	default:
		return reconcileCauseSystem
	}
}

var timeToExpiryBuckets = []float64{0, 30, 60, 120, 300, 600, 1800, 3600}
var generationDurationBuckets = []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0}

// connectionTokenMetrics tracks token lifecycle events for connections.
type connectionTokenMetrics struct {
	generatedTotal     prometheus.Counter
	generationErrors   *prometheus.CounterVec
	generatedDuration  prometheus.Histogram
	refreshReasonTotal *prometheus.CounterVec
	timeToExpiry       prometheus.Histogram
	// expired is incremented every reconcile that observes an already-expired
	// connection token, from the persisted status.token.expiration, and re-emitted
	// each resync while the condition holds (a token whose refresh keeps failing
	// keeps incrementing). It mirrors the repository counter. It is deliberately
	// unlabeled by cause: expiry is read from persisted status, not from a live
	// generation attempt, so the failure cause is not known here. Correlate with
	// generationErrors' cause label for triage.
	expired prometheus.Counter
}

func registerConnectionTokenMetrics(reg prometheus.Registerer) *connectionTokenMetrics {
	generatedTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_connection_token_generated_total",
		Help: "Total number of connection tokens generated successfully",
	})
	reg.MustRegister(generatedTotal)

	generationErrors := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_connection_token_generation_errors_total",
		Help: "Total number of connection token generation errors by cause. Filter cause!=\"user\" to exclude user-caused failures (e.g. revoked credentials, app uninstalled) from SLOs.",
	}, []string{"cause"})
	reg.MustRegister(generationErrors)

	generatedDuration := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_connection_token_generated_duration_seconds",
		Help:    "Duration of successful connection token generations",
		Buckets: generationDurationBuckets,
	})
	reg.MustRegister(generatedDuration)

	refreshReasonTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_connection_token_refresh_reason_total",
		Help: "Reason a connection token refresh was triggered",
	}, []string{"reason"})
	reg.MustRegister(refreshReasonTotal)

	timeToExpiry := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_connection_token_time_to_expiry_seconds",
		Help:    "Remaining TTL of connection tokens observed during reconciliation",
		Buckets: timeToExpiryBuckets,
	})
	reg.MustRegister(timeToExpiry)

	expired := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_connection_tokens_expired_total",
		Help: "Number of reconciliations that observed an already-expired connection token (re-emitted each resync while the condition holds)",
	})
	reg.MustRegister(expired)

	return &connectionTokenMetrics{
		generatedTotal:     generatedTotal,
		generationErrors:   generationErrors,
		generatedDuration:  generatedDuration,
		refreshReasonTotal: refreshReasonTotal,
		timeToExpiry:       timeToExpiry,
		expired:            expired,
	}
}

func (m *connectionTokenMetrics) recordGeneration(seconds float64) {
	if m == nil {
		return
	}
	m.generatedTotal.Inc()
	m.generatedDuration.Observe(seconds)
}

func (m *connectionTokenMetrics) recordGenerationError(cause string) {
	if m == nil {
		return
	}
	m.generationErrors.WithLabelValues(cause).Inc()
}

func (m *connectionTokenMetrics) recordRefreshReason(reason refreshReason) {
	if m == nil {
		return
	}
	m.refreshReasonTotal.WithLabelValues(string(reason)).Inc()
}

func (m *connectionTokenMetrics) recordTimeToExpiry(seconds float64) {
	if m == nil {
		return
	}
	if seconds < 0 {
		seconds = 0
	}
	m.timeToExpiry.Observe(seconds)
}

func (m *connectionTokenMetrics) recordExpired() {
	if m == nil {
		return
	}
	m.expired.Inc()
}

// repositoryTokenMetrics tracks token lifecycle events for repositories.
type repositoryTokenMetrics struct {
	generatedTotal     prometheus.Counter
	generationErrors   *prometheus.CounterVec
	generatedDuration  prometheus.Histogram
	refreshReasonTotal *prometheus.CounterVec
	timeToExpiry       prometheus.Histogram
	// expired is incremented every reconcile that observes an already-expired
	// repository token. It is deliberately re-emitted on each resync rather than
	// edge-triggered once: a token stuck expired (its refresh failing) keeps
	// incrementing, so increase()/rate() alerts fire for as long as the condition
	// holds. It is intentionally unlabeled by cause: expiry is read from persisted
	// status, not from a live generation attempt, so the failure cause is not
	// known here. Correlate with generationErrors' cause label for triage.
	expired prometheus.Counter
}

func registerRepositoryTokenMetrics(reg prometheus.Registerer) *repositoryTokenMetrics {
	generatedTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_token_generated_total",
		Help: "Total number of repository tokens generated successfully",
	})
	reg.MustRegister(generatedTotal)

	generationErrors := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_token_generation_errors_total",
		Help: "Total number of repository token generation errors by cause. Filter cause!=\"user\" to exclude user-caused failures (e.g. revoked credentials, app uninstalled) from SLOs.",
	}, []string{"cause"})
	reg.MustRegister(generationErrors)

	generatedDuration := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_repository_token_generated_duration_seconds",
		Help:    "Duration of successful repository token generations",
		Buckets: generationDurationBuckets,
	})
	reg.MustRegister(generatedDuration)

	refreshReasonTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_token_refresh_reason_total",
		Help: "Reason a repository token refresh was triggered",
	}, []string{"reason"})
	reg.MustRegister(refreshReasonTotal)

	timeToExpiry := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_repository_token_time_to_expiry_seconds",
		Help:    "Remaining TTL of repository tokens observed during reconciliation",
		Buckets: timeToExpiryBuckets,
	})
	reg.MustRegister(timeToExpiry)

	expired := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_tokens_expired_total",
		Help: "Number of reconciliations that observed an already-expired repository token (re-emitted each resync while the condition holds)",
	})
	reg.MustRegister(expired)

	return &repositoryTokenMetrics{
		generatedTotal:     generatedTotal,
		generationErrors:   generationErrors,
		generatedDuration:  generatedDuration,
		refreshReasonTotal: refreshReasonTotal,
		timeToExpiry:       timeToExpiry,
		expired:            expired,
	}
}

func (m *repositoryTokenMetrics) recordGeneration(seconds float64) {
	if m == nil {
		return
	}
	m.generatedTotal.Inc()
	m.generatedDuration.Observe(seconds)
}

func (m *repositoryTokenMetrics) recordGenerationError(cause string) {
	if m == nil {
		return
	}
	m.generationErrors.WithLabelValues(cause).Inc()
}

func (m *repositoryTokenMetrics) recordRefreshReason(reason refreshReason) {
	if m == nil {
		return
	}
	m.refreshReasonTotal.WithLabelValues(string(reason)).Inc()
}

func (m *repositoryTokenMetrics) recordTimeToExpiry(seconds float64) {
	if m == nil {
		return
	}
	if seconds < 0 {
		seconds = 0
	}
	m.timeToExpiry.Observe(seconds)
}

func (m *repositoryTokenMetrics) recordExpired() {
	if m == nil {
		return
	}
	m.expired.Inc()
}
