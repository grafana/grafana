package controller

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Deletion stages, used as the "stage" label on the failure counter so a
// finalizer-processing failure is distinguishable from a failure to strip the
// finalizers off the object afterwards.
const (
	// deletionStageFinalizers is the finalizer.process() call that runs the
	// registered finalizers (orphan-resource cleanup, etc.).
	deletionStageFinalizers = "process_finalizers"
	// deletionStageRemoveFinalizers is the JSON-Patch that removes the finalizers
	// once processing succeeds. Its failure (notably RetryOnConflict exhaustion)
	// was previously unmetered: it lands only in status.deleteError and never
	// touches the finalizer SLO, so a repository can wedge in Terminating with no
	// Prometheus signal at all.
	deletionStageRemoveFinalizers = "remove_finalizers"
)

// A repository should leave Terminating within seconds; anything past a few
// minutes is stuck. Resolution is fine early and coarsens through the hours a
// stuck deletion lingers, with a 1h bucket so an alert can count reconciles that
// observe a repository still terminating past that threshold.
var repositoryDeletionPendingBuckets = []float64{
	time.Second.Seconds(),
	(5 * time.Second).Seconds(),
	(15 * time.Second).Seconds(),
	(30 * time.Second).Seconds(),
	time.Minute.Seconds(),
	(5 * time.Minute).Seconds(),
	(15 * time.Minute).Seconds(),
	(30 * time.Minute).Seconds(),
	time.Hour.Seconds(),
	(2 * time.Hour).Seconds(),
	(6 * time.Hour).Seconds(),
	(24 * time.Hour).Seconds(),
}

// repositoryDeletionMetrics tracks the health of the repository delete path.
//
// Both series are aggregate (no per-repository/namespace label) so they stay
// bounded in the multi-tenant operator; the per-repository "which repo is stuck"
// view is carried by the deletion-status log line (see usage.LogRepositoryDeletionStatus).
// They are re-emitted on every delete reconcile, so a repository that stays stuck
// keeps observing its age and re-incrementing the failure counter at resync
// cadence — the signal persists for as long as the repository is wedged rather
// than firing once and going quiet.
type repositoryDeletionMetrics struct {
	pendingSeconds prometheus.Histogram
	failuresTotal  *prometheus.CounterVec
}

func registerRepositoryDeletionMetrics(registry prometheus.Registerer) *repositoryDeletionMetrics {
	pendingSeconds := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_repository_deletion_pending_seconds",
		Help:    "Age of a repository still in Terminating, observed on each delete reconcile.",
		Buckets: repositoryDeletionPendingBuckets,
	})
	failuresTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_deletion_failures_total",
		Help: "Total number of repository delete-path failures, by stage.",
	}, []string{"stage"})
	registry.MustRegister(pendingSeconds, failuresTotal)

	return &repositoryDeletionMetrics{pendingSeconds: pendingSeconds, failuresTotal: failuresTotal}
}

// observePending records how long a repository has been in Terminating. Called
// once per delete reconcile, so a stuck repository re-observes its growing age at
// resync cadence and its observations climb through the buckets.
func (m *repositoryDeletionMetrics) observePending(age time.Duration) {
	if m == nil {
		return
	}
	if age < 0 {
		age = 0
	}
	m.pendingSeconds.Observe(age.Seconds())
}

// recordFailure counts a delete-path failure at the given stage.
func (m *repositoryDeletionMetrics) recordFailure(stage string) {
	if m == nil {
		return
	}
	m.failuresTotal.WithLabelValues(stage).Inc()
}
