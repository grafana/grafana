package cascadedelete

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	pendingv1alpha1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1alpha1"
)

type pendingMetrics struct {
	duration prometheus.Histogram
	skipped  prometheus.Counter
	missing  prometheus.Counter
}

func WithPendingMetrics(reg prometheus.Registerer) ControllerOption {
	return func(c *Controller) {
		factory := promauto.With(reg)
		c.pendingMetrics = &pendingMetrics{
			duration: factory.NewHistogram(prometheus.HistogramOpts{
				Name:    "grafana_folder_deletion_observed_duration_seconds",
				Help:    "Time from folder deletion timestamp until reconciliation observes completion, including scan delay. Samples are best effort.",
				Buckets: []float64{1, 10, 30, 60, 300, 600, 1800, 3600, 21600, 86400},
			}),
			skipped: factory.NewCounter(prometheus.CounterOpts{Name: "grafana_folder_deletion_duration_skipped_total", Help: "Completed pending folder deletions without a usable captured deletion timestamp."}),
			missing: factory.NewCounter(prometheus.CounterOpts{Name: "grafana_folder_deletion_pending_missing_total", Help: "Observations of terminating folders without a pending deletion entry."}),
		}
	}
}

func (m *pendingMetrics) completed(entry *pendingv1alpha1.PendingFolderDeletion) {
	if m == nil {
		return
	}
	if entry.Spec.DeletionTimestamp != nil {
		if start, err := time.Parse(time.RFC3339Nano, *entry.Spec.DeletionTimestamp); err == nil {
			m.duration.Observe(max(0, time.Since(start).Seconds()))
			return
		}
	}
	m.skipped.Inc()
}
