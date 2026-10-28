package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// StatusSyncer holds metrics for the rule-status syncer, which projects rule
// state/health onto the app-platform AlertRule/RecordingRule status subresources.
type StatusSyncer struct {
	SyncTotal    prometheus.Counter
	SyncFailures prometheus.Counter
	SyncDuration prometheus.Histogram
	Writes       prometheus.Counter
}

func NewStatusSyncerMetrics(r prometheus.Registerer) *StatusSyncer {
	return &StatusSyncer{
		SyncTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "rule_status_sync_total",
			Help:      "The total number of rule status sync cycles attempted.",
		}),
		SyncFailures: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "rule_status_sync_failures_total",
			Help:      "The total number of rule status sync cycles that failed.",
		}),
		SyncDuration: promauto.With(r).NewHistogram(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "rule_status_sync_duration_seconds",
			Help:      "The time to sync rule status onto the app-platform rule resources.",
			Buckets:   []float64{0.1, 0.5, 1, 2, 5, 10, 15, 30, 60},
		}),
		Writes: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "rule_status_writes_total",
			Help:      "The total number of rule status subresource writes issued (after change detection).",
		}),
	}
}
