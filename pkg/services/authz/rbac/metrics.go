package rbac

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "authz_direct_db_service"
)

type metrics struct {
	requestCount                  *prometheus.CounterVec
	permissionCacheUsage          *prometheus.CounterVec
	legacyCheckRequests           *prometheus.CounterVec
	legacyCheckErrors             *prometheus.CounterVec
	legacyCheckDuration           *prometheus.HistogramVec
	legacyScopeResolutionDuration prometheus.Histogram
}

func newMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		legacyCheckRequests: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_authz_legacy_check_requests_total",
			Help: "LegacyCheck requests by evaluation context and whether access was allowed. Failed checks are counted as not allowed.",
		}, []string{"evaluation", "allowed"}),
		legacyCheckErrors: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_authz_legacy_check_errors_total",
			Help: "LegacyCheck failures by evaluation context and error type: rpc for returned Go errors, application for errors in the response body.",
		}, []string{"evaluation", "error_type"}),
		legacyCheckDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grafana_authz_legacy_check_duration_seconds",
			Help:    "Time spent handling LegacyCheck requests.",
			Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
		}, []string{"evaluation", "allowed"}),
		legacyScopeResolutionDuration: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:    "grafana_authz_legacy_check_scope_resolution_duration_seconds",
			Help:    "Time spent resolving legacy scopes, including cached results and loading resolver permission dependencies.",
			Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
		}),
		requestCount: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "invalid_request_count",
				Help:      "AuthZ service invalid request count",
			},
			[]string{"is_error", "valid", "verb", "group", "resource", "subresource"},
		),
		permissionCacheUsage: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "permission_cache_usage",
				Help:      "AuthZ service permission cache usage",
			},
			[]string{"cache_hit", "action"},
		),
	}
}
