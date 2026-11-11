package metrics

import (
	"errors"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "plugins_app"
)

var (
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
			Help:      "Total number of metadata fetch errors by provider, error type and originating service identity.",
		},
		[]string{"provider", "error_type", "origin_caller"}, // origin_caller: innermost service identity of the request, or "unknown"
	)

	// Meta request metrics
	MetaRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_requests_total",
			Help:      "Total number of metadata requests by plugin ID, version and calling service identity",
		},
		[]string{"plugin_id", "version", "caller"},
	)

	// APIRequestsTotal counts inbound plugins API requests by caller. The built-in
	// apiserver_request_total has no caller dimension. Status codes are left to that metric.
	APIRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "api_requests_total",
			Help:      "Total number of plugins API requests by resource, verb and calling service identity",
		},
		[]string{"resource", "verb", "caller"}, // caller: immediate service identity from the access token, or "unknown"
	)

	MetaResolutionFailuresTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_resolution_failures_total",
			Help:      "Total number of per-plugin metadata resolution failures across all providers",
		},
		[]string{"plugin_id", "reason"}, // reason: "not_found" or "error"
	)

	MetaBuildVersionFallbacksTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "meta_build_version_fallbacks_total",
			Help:      "Total number of catalog lookups of a Grafana build version resolved with the plugin's latest version",
		},
		[]string{"plugin_id"},
	)
)

func MustRegister(registerer prometheus.Registerer) {
	metricsToRegister := []prometheus.Collector{
		RegistrationOperationsTotal,
		RegistrationDurationSeconds,
		MetaCacheLookupTotal,
		MetaCacheSize,
		MetaCacheEvictionsTotal,
		MetaFetchDurationSeconds,
		MetaFetchErrorsTotal,
		MetaRequestsTotal,
		MetaResolutionFailuresTotal,
		MetaBuildVersionFallbacksTotal,
		APIRequestsTotal,
	}

	for _, metric := range metricsToRegister {
		if err := registerer.Register(metric); err != nil {
			if _, ok := errors.AsType[prometheus.AlreadyRegisteredError](err); ok {
				continue
			}
			panic(err)
		}
	}
}
