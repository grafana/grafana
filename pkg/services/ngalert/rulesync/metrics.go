package rulesync

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

// mask53 masks a 64-bit hash to 53 bits so it fits Prometheus's float64 gauge
// storage without loss, matching the alertmanager_config_hash / external AM
// sync hash gauges.
const mask53 = (1 << 53) - 1

// Metrics holds the external ruler sync metrics. They mirror the external
// Alertmanager config sync metrics (partitioned by org, and by reason for
// failures) so operators get a consistent view across both syncs.
type Metrics struct {
	// SyncTotal counts sync attempts that successfully fetched and parsed the
	// upstream ruler config, by org (includes ticks deduped to the same hash).
	SyncTotal *prometheus.CounterVec
	// SyncFailures counts failed sync attempts by org and reason.
	SyncFailures *prometheus.CounterVec
	// SyncDuration measures per-org sync duration in seconds.
	SyncDuration *prometheus.HistogramVec
	// SyncHash exposes the FNV-1a hash of the most recently synced ruler config
	// per org (masked to 53 bits), so operators can correlate sync state with
	// what's applied.
	SyncHash *prometheus.GaugeVec
}

// NewMetrics constructs the external ruler sync metrics against r. Pass nil to
// disable registration (e.g. in tests).
func NewMetrics(r prometheus.Registerer) *Metrics {
	return &Metrics{
		SyncTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: metrics.Namespace,
			Subsystem: metrics.Subsystem,
			Name:      "external_ruler_sync_total",
			Help:      "Total number of successful external ruler sync attempts, partitioned by org.",
		}, []string{"org_id"}),
		SyncFailures: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: metrics.Namespace,
			Subsystem: metrics.Subsystem,
			Name:      "external_ruler_sync_failures_total",
			Help:      "Total number of failed external ruler sync attempts, partitioned by org and failure reason.",
		}, []string{"org_id", "reason"}),
		SyncDuration: promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metrics.Namespace,
			Subsystem: metrics.Subsystem,
			Name:      "external_ruler_sync_duration_seconds",
			Help:      "Duration of external ruler sync operations in seconds, partitioned by org.",
			Buckets:   prometheus.DefBuckets,
		}, []string{"org_id"}),
		SyncHash: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: metrics.Namespace,
			Subsystem: metrics.Subsystem,
			Name:      "external_ruler_sync_hash",
			Help:      "FNV-1a hash of the most recently synced external ruler configuration per org, masked to 53 bits to fit Prometheus float64 storage.",
		}, []string{"org_id"}),
	}
}
