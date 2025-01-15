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
	checkRequestDuration *prometheus.HistogramVec
	listRequestDuration  *prometheus.HistogramVec
	requestCount         *prometheus.CounterVec
	permissionCacheUsage *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		checkRequestDuration: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "check_request_duration_seconds",
				Help:      "AuthZ service check request duration",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"is_error", "verb", "group", "resource"},
		),
		listRequestDuration: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "list_request_duration_seconds",
				Help:      "AuthZ service list request duration",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"is_error", "group", "resource"},
		),
		requestCount: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "invalid_request_count",
				Help:      "AuthZ service invalid request count",
			},
			[]string{"is_error", "valid", "verb", "group", "resource"},
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
