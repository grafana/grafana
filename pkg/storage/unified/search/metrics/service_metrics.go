package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type ServiceMetrics struct {
	*BuildMetrics
	SearchUpdateWaitTime              *prometheus.HistogramVec
	RebuildQueueLength                prometheus.Gauge
	ReconcileQueueLength              prometheus.Gauge
	GlobalReconcileDuration           *prometheus.HistogramVec
	SearchServicePermissionFailures   *prometheus.CounterVec
	SearchServicePermissionExemptions *prometheus.CounterVec
	BuildSourceBytes                  *prometheus.CounterVec
}

func ProvideServiceMetrics(reg prometheus.Registerer, build *BuildMetrics) *ServiceMetrics {
	if build == nil {
		build = ProvideBuildMetrics(reg)
	}
	m := &ServiceMetrics{
		BuildMetrics: build,
		SearchUpdateWaitTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_index_server_search_update_wait_time_seconds",
			Help:                            "Time spent waiting for index update during search queries",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"reason"}),
		RebuildQueueLength: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "grafana_index_server_rebuild_queue_length",
			Help: "Number of indexes waiting for rebuild",
		}),
		ReconcileQueueLength: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "grafana_index_server_global_reconcile_queue_length",
			Help: "Number of global search indexes waiting to be compared with storage",
		}),
		GlobalReconcileDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_index_server_global_reconcile_duration_seconds",
			Help:                            "Time to compare one global search index with storage and repair what differs",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"result"}),
		BuildSourceBytes: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_index_server_build_source_bytes_total",
			Help: "Bytes of stored objects read while building or updating an index.",
		}, []string{"path", "group", "resource"}),
		SearchServicePermissionFailures: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_index_server_search_service_permission_failures_total",
			Help: "Search requests rejected before scanning because the service token lacks a required direct or delegated permission.",
		}, []string{"mode"}),
		SearchServicePermissionExemptions: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_index_server_search_service_permission_exemptions_total",
			Help: "Service token permission failures ignored before scanning because the resource is exempt from RBAC.",
		}, []string{"group", "resource", "mode"}),
	}
	m.SearchServicePermissionFailures.WithLabelValues("direct").Add(0)
	m.SearchServicePermissionFailures.WithLabelValues("delegated").Add(0)
	return m
}
