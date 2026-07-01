package usagestats

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type metrics struct {
	// droppedEvents counts events that were not recorded. The "reason" label
	// distinguishes misconfigured clients (untracked resource / unknown metric)
	// from buffer overflow.
	droppedEvents *prometheus.CounterVec
	// flushDuration observes how long a flush cycle takes. The flush does a
	// read-add-write per object under a lease, so this is the early warning
	// for flushes slowing down as a namespace accumulates objects.
	flushDuration prometheus.Histogram
}

const (
	reasonUntrackedResource = "untracked_resource"
	reasonUnknownMetric     = "unknown_metric"
	reasonBufferFull        = "buffer_full"
)

func newMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		droppedEvents: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "unified_storage_stats_dropped_events_total",
			Help: "Total number of usage stats events dropped without being recorded.",
		}, []string{"reason"}),
		flushDuration: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:    "unified_storage_stats_flush_duration_seconds",
			Help:    "Duration of a usage stats flush cycle.",
			Buckets: prometheus.DefBuckets,
		}),
	}
}

func (m *metrics) dropEvents(reason string, n int) {
	if m == nil || n <= 0 {
		return
	}
	m.droppedEvents.WithLabelValues(reason).Add(float64(n))
}
