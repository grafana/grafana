package controller

import (
	"github.com/prometheus/client_golang/prometheus"
)

type refreshReason string

const (
	refreshReasonMissing  refreshReason = "missing"
	refreshReasonInvalid  refreshReason = "invalid"
	refreshReasonExpiring refreshReason = "expiring"
)

var timeToExpiryBuckets = []float64{0, 30, 60, 120, 300, 600, 1800, 3600}
var generationDurationBuckets = []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0}

// connectionTokenMetrics tracks token lifecycle events for connections.
type connectionTokenMetrics struct {
	generatedTotal     prometheus.Counter
	generationErrors   prometheus.Counter
	generatedDuration  prometheus.Histogram
	refreshReasonTotal *prometheus.CounterVec
	timeToExpiry       prometheus.Histogram
}

func registerConnectionTokenMetrics(reg prometheus.Registerer) *connectionTokenMetrics {
	generatedTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_connection_token_generated_total",
		Help: "Total number of connection tokens generated successfully",
	})
	reg.MustRegister(generatedTotal)

	generationErrors := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_connection_token_generation_errors_total",
		Help: "Total number of connection token generation errors",
	})
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

	return &connectionTokenMetrics{
		generatedTotal:     generatedTotal,
		generationErrors:   generationErrors,
		generatedDuration:  generatedDuration,
		refreshReasonTotal: refreshReasonTotal,
		timeToExpiry:       timeToExpiry,
	}
}

func (m *connectionTokenMetrics) recordGeneration(seconds float64) {
	if m == nil {
		return
	}
	m.generatedTotal.Inc()
	m.generatedDuration.Observe(seconds)
}

func (m *connectionTokenMetrics) recordGenerationError() {
	if m == nil {
		return
	}
	m.generationErrors.Inc()
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

// repositoryTokenMetrics tracks token lifecycle events for repositories.
type repositoryTokenMetrics struct {
	generatedTotal     prometheus.Counter
	generationErrors   prometheus.Counter
	generatedDuration  prometheus.Histogram
	refreshReasonTotal *prometheus.CounterVec
	timeToExpiry       prometheus.Histogram
	// nearExpiring and expired are incremented every reconcile that observes a
	// repository token within its refresh window / already past expiration. They
	// are deliberately re-emitted on each resync rather than edge-triggered once:
	// a token stuck expired (its refresh failing) keeps incrementing expired every
	// resync, so increase()/rate() alerts fire for as long as the condition holds.
	nearExpiring prometheus.Counter
	expired      prometheus.Counter
}

func registerRepositoryTokenMetrics(reg prometheus.Registerer) *repositoryTokenMetrics {
	generatedTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_token_generated_total",
		Help: "Total number of repository tokens generated successfully",
	})
	reg.MustRegister(generatedTotal)

	generationErrors := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_token_generation_errors_total",
		Help: "Total number of repository token generation errors",
	})
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

	nearExpiring := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_tokens_near_expiring_total",
		Help: "Number of reconciliations that observed a repository token within its refresh window (re-emitted each resync while the condition holds)",
	})
	reg.MustRegister(nearExpiring)

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
		nearExpiring:       nearExpiring,
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

func (m *repositoryTokenMetrics) recordGenerationError() {
	if m == nil {
		return
	}
	m.generationErrors.Inc()
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

func (m *repositoryTokenMetrics) recordNearExpiring() {
	if m == nil {
		return
	}
	m.nearExpiring.Inc()
}

func (m *repositoryTokenMetrics) recordExpired() {
	if m == nil {
		return
	}
	m.expired.Inc()
}
