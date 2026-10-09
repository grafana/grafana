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
	RequestDuration        *prometheus.HistogramVec
	DegradedOperations     *prometheus.CounterVec
	ListBodyKeysRequested  *prometheus.CounterVec
	ListBodiesConsumed     *prometheus.CounterVec
	ListItemsReturned      *prometheus.CounterVec
	ListUnusedBodyRequests *prometheus.HistogramVec
	Broadcaster            *BroadcasterMetrics
}

func ProvideStorageMetrics(reg prometheus.Registerer) *StorageMetrics {
	return &StorageMetrics{
		WatchEventLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_storage_server_watch_event_latency_seconds",
			Help:                            "Time (in seconds) from resource version generation to the watch event being scheduled with the gRPC transport",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource"}),
		WatchEventReadyLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_storage_server_watch_event_ready_latency_seconds",
			Help:                            "Time (in seconds) from resource version generation until the watch event is ready to be sent over gRPC",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource"}),
		WatchEventSendDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_storage_server_watch_event_send_duration_seconds",
			Help:                            "Time (in seconds) spent scheduling a watch event with the gRPC transport, including its flow-control wait",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource"}),
		PollerLatency: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "grafana_storage_server_poller_query_latency_seconds",
			Help:                            "poller query latency",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		RequestDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_storage_server_grpc_request_duration_seconds",
			Help:                            "Time (in seconds) spent serving unified storage gRPC requests, labeled by method, group, resource, status, and List execution path.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"method", "group", "resource", "status_code", "list_path"}),
		DegradedOperations: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_degraded_operations_total",
			Help: "Operations that proceeded despite a failed external dependency " +
				"(e.g. a guard/check that was skipped because a downstream call failed).",
		}, []string{"operation", "reason", "group", "resource"}),
		ListBodyKeysRequested: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_list_body_keys_requested_total",
			Help: "Body keys requested via datastore BatchGet by KV-backed store lists, not database rows read. Includes missing keys; retries inside KV implementations are not counted.",
		}, []string{"list_path", "stop_reason"}),
		ListBodiesConsumed: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_list_bodies_consumed_total",
			Help: "Body values yielded by the KV iterator to datastore for KV-backed store lists, including lookahead. Does not count driver read-ahead or drained rows.",
		}, []string{"list_path", "stop_reason"}),
		ListItemsReturned: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_list_items_returned_total",
			Help: "Items in successful KV-backed store list responses with body-read accounting. Failed responses contribute zero items.",
		}, []string{"list_path", "stop_reason"}),
		ListUnusedBodyRequests: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grafana_storage_server_list_unused_body_requests",
			Help:    "Requested body keys minus returned items per successful KV-backed store list. Measures over-requesting, not actual database overfetch; includes missing and unauthorized resources.",
			Buckets: []float64{0, 1, 2, 5, 10, 25, 49, 50, 100, 250, 500, 1000},
		}, []string{"list_path", "stop_reason"}),
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
