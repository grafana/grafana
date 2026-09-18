package controller

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Deletion stages, used as the "stage" label on the error counter so the
// distinct delete-path failure points are distinguishable from one another.
const (
	// deletionStageBuild is the repoFactory.Build() call that constructs the
	// repository before its finalizers can run. Its failure (e.g. missing or
	// invalid credentials) leaves the repository stuck in Terminating.
	deletionStageBuild = "build"
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
// All series are aggregate (no per-repository/namespace label) so they stay
// bounded in the multi-tenant operator; the per-repository "which repo is stuck"
// view is carried by the "handle repository delete" log line. deletionsTotal and
// errorsTotal pair up as a completed-vs-errored rate: deletionsTotal increments
// once when a deletion finishes, while errorsTotal re-increments every failing
// reconcile, so a repository that stays stuck keeps the error signal alive (and
// its age climbing in pendingSeconds) at resync cadence rather than firing once
// and going quiet.
type repositoryDeletionMetrics struct {
	pendingSeconds prometheus.Histogram
	deletionsTotal prometheus.Counter
	errorsTotal    *prometheus.CounterVec
}

func registerRepositoryDeletionMetrics(registry prometheus.Registerer) *repositoryDeletionMetrics {
	pendingSeconds := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_repository_deletion_pending_seconds",
		Help:    "Age of a repository still in Terminating, observed on each delete reconcile.",
		Buckets: repositoryDeletionPendingBuckets,
	})
	deletionsTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_deletions_total",
		Help: "Total number of repository deletions the controller completed by removing finalizers. A repository deleted with no finalizers is a no-op (nothing to clean up; GC removes it) and is not counted, keeping this paired with the finalizer errors in deletion_errors_total over the same population.",
	})
	errorsTotal := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_deletion_errors_total",
		Help: "Total number of repository delete-path errors, by stage.",
	}, []string{"stage"})
	registry.MustRegister(pendingSeconds, deletionsTotal, errorsTotal)

	return &repositoryDeletionMetrics{
		pendingSeconds: pendingSeconds,
		deletionsTotal: deletionsTotal,
		errorsTotal:    errorsTotal,
	}
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

// recordDeletion counts a repository deletion that the delete path completed
// (finalizers processed and removed, or nothing to do).
func (m *repositoryDeletionMetrics) recordDeletion() {
	if m == nil {
		return
	}
	m.deletionsTotal.Inc()
}

// recordError counts a delete-path error at the given stage.
func (m *repositoryDeletionMetrics) recordError(stage string) {
	if m == nil {
		return
	}
	m.errorsTotal.WithLabelValues(stage).Inc()
}
