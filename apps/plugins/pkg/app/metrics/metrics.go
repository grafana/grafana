package metrics

import (
	"errors"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "plugins_app"
)

var (
	// Plugin reconciliation metrics
	ChildReconciliationTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "plugin_child_reconciliation_total",
			Help:      "Total number of child plugin reconciliation operations",
		},
		[]string{"status", "action", "plugin_id"},
	)

	ChildReconciliationDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "plugin_child_reconciliation_duration_seconds",
			Help:      "Duration of child plugin reconciliation operations in seconds",
			Buckets:   prometheus.DefBuckets,
		},
	)

	ChildrenCountPerReconcile = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "plugin_children_count_per_reconcile",
			Help:      "Number of child plugins found per reconciliation cycle.",
			Buckets:   []float64{0, 1, 2, 3, 5, 7, 10},
		},
	)

	// Plugin registration metrics
	RegistrationOperationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "plugin_registration_operations_total",
			Help:      "Total number of plugin registration operations",
		},
		[]string{"operation", "status"},
	)

	RegistrationDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "plugin_registration_duration_seconds",
			Help:      "Duration of plugin registration operations in seconds",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"operation"},
	)

	// Meta cache metrics
	MetaCacheLookupTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_cache_lookup_total",
			Help:      "Total number of cache lookups for plugin metadata",
		},
		[]string{"result"}, // "hit" or "miss"
	)

	MetaCacheSize = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "meta_cache_size",
			Help:      "Current number of entries in the metadata cache",
		},
	)

	MetaCacheEvictionsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_cache_evictions_total",
			Help:      "Total number of cache evictions due to expiration",
		},
	)

	// Meta fetch metrics
	MetaFetchDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "meta_fetch_duration_seconds",
			Help:      "Duration of metadata fetch operations from providers in seconds",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"provider", "status"}, // provider: "catalog", etc; status: "success", "error", "not_found"
	)

	MetaFetchErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_fetch_errors_total",
			Help:      "Total number of metadata fetch errors by provider and error type.",
		},
		[]string{"provider", "error_type"},
	)

	// Meta request metrics
	MetaRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_requests_total",
			Help:      "Total number of metadata requests by plugin ID and version (useful for cache warming analysis)",
		},
		[]string{"plugin_id", "version"},
	)
)

func MustRegister(registerer prometheus.Registerer) {
	metricsToRegister := []prometheus.Collector{
		ChildReconciliationTotal,
		ChildReconciliationDurationSeconds,
		ChildrenCountPerReconcile,
		RegistrationOperationsTotal,
		RegistrationDurationSeconds,
		MetaCacheLookupTotal,
		MetaCacheSize,
		MetaCacheEvictionsTotal,
		MetaFetchDurationSeconds,
		MetaFetchErrorsTotal,
		MetaRequestsTotal,
	}

	for _, metric := range metricsToRegister {
		if err := registerer.Register(metric); err != nil {
			var alreadyRegistered prometheus.AlreadyRegisteredError
			if errors.As(err, &alreadyRegistered) {
				continue
			}
			panic(err)
		}
	}
}
