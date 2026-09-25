package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type StorageMetrics struct {
	WatchEventLatency      *prometheus.HistogramVec
	WatchEventReadyLatency *prometheus.HistogramVec
	WatchEventSendDuration *prometheus.HistogramVec
	PollerLatency          prometheus.Histogram
	ListWithFieldSelectors *prometheus.CounterVec
	RequestDuration        *prometheus.HistogramVec
	DegradedOperations     *prometheus.CounterVec
	Broadcaster            *BroadcasterMetrics
}

func ProvideStorageMetrics(reg prometheus.Registerer) *StorageMetrics {
	return &StorageMetrics{
		WatchEventLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "storage_server_watch_event_latency_seconds",
			Help:                            "Time (in seconds) from resource version generation to the watch event being scheduled with the gRPC transport",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource"}),
		WatchEventReadyLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "storage_server_watch_event_ready_latency_seconds",
			Help:                            "Time (in seconds) from resource version generation until the watch event is ready to be sent over gRPC",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource"}),
		WatchEventSendDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "storage_server_watch_event_send_duration_seconds",
			Help:                            "Time (in seconds) spent scheduling a watch event with the gRPC transport, including its flow-control wait",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource"}),
		PollerLatency: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "storage_server_poller_query_latency_seconds",
			Help:                            "poller query latency",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		ListWithFieldSelectors: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_field_selector_search_total",
			Help: "number of times List was served by field selector search",
		}, []string{"resource", "served_by"}),
		RequestDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "storage_server_grpc_request_duration_seconds",
			Help:                            "Time (in seconds) spent serving unified storage gRPC requests, labeled by group and resource.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"method", "group", "resource", "status_code"}),
		DegradedOperations: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_degraded_operations_total",
			Help: "Operations that proceeded despite a failed external dependency " +
				"(e.g. a guard/check that was skipped because a downstream call failed).",
		}, []string{"operation", "reason", "group", "resource"}),
		Broadcaster: newBroadcasterMetrics(reg),
	}
}

func (m *StorageMetrics) observeWatchEvent(group, resource string, resourceVersionAt, sendStartedAt, sentAt time.Time) {
	readySeconds := sendStartedAt.Sub(resourceVersionAt).Seconds()
	sendSeconds := sentAt.Sub(sendStartedAt).Seconds()
	if readySeconds < 0 || sendSeconds < 0 {
		return
	}

	labels := []string{group, resource}
	m.WatchEventLatency.WithLabelValues(labels...).Observe(readySeconds + sendSeconds)
	m.WatchEventReadyLatency.WithLabelValues(labels...).Observe(readySeconds)
	m.WatchEventSendDuration.WithLabelValues(labels...).Observe(sendSeconds)
}
