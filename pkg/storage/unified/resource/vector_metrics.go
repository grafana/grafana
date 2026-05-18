package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// VectorMetrics groups Prometheus metrics for the unified-storage vector
// embedding pipeline: the VectorSearch RPC, the reconciler that keeps the
// vector index in sync with writes, and the backfiller that catches up
// over existing resources.
type VectorMetrics struct {
	SearchDuration *prometheus.HistogramVec

	// EmbedDuration measures the latency of a single TextEmbedder call
	// (the network round-trip to Bedrock/Vertex). Shared across all
	// callers: VectorSearch query-side embed plus reconciler and
	// backfill document-side batches. Labels:
	//   model  — full model identifier, e.g. "bedrock/cohere.embed-v4"
	//   task   — "Query" vs "Retrieval"
	//   status — "success" or "error"
	EmbedDuration *prometheus.HistogramVec

	ReconcilerProcessDuration *prometheus.HistogramVec
	ReconcilerPendingEvents   prometheus.Gauge
	ReconcilerRetriesTotal    *prometheus.CounterVec
	// ReconcilerEventsDroppedTotal counts events the reconciler gave up on.
	// Labels:
	//   group, resource — bounded resource identifiers
	//   reason          — currently always "retries_exhausted"; future reasons
	//                     (e.g. "unknown_action") can be added without
	//                     changing the metric shape.
	ReconcilerEventsDroppedTotal *prometheus.CounterVec

	BackfillItemDuration *prometheus.HistogramVec
}

func ProvideVectorMetrics(reg prometheus.Registerer) *VectorMetrics {
	return &VectorMetrics{
		SearchDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "vector_search_duration_seconds",
			Help:                            "Time (in seconds) spent serving the VectorSearch RPC, labeled by group, resource, and gRPC status code.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "status_code"}),
		EmbedDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "vector_embed_duration_seconds",
			Help:                            "Time (in seconds) spent in a single TextEmbedder call to the provider (Vertex/Bedrock), labeled by model, task, and status.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"model", "task", "status"}),

		ReconcilerProcessDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "vector_reconciler_process_duration_seconds",
			Help:                            "Time (in seconds) to process a single embedding event in the reconciler, labeled by group, resource, and outcome status.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "status"}),
		ReconcilerPendingEvents: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "storage_server_vector_reconciler_pending_events",
			Help: "Current number of events pending processing in the embedding reconciler dedup map.",
		}),
		ReconcilerRetriesTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_vector_reconciler_retries_total",
			Help: "Total number of reconciler events re-queued after a failure.",
		}, []string{"group", "resource"}),
		ReconcilerEventsDroppedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_vector_reconciler_events_dropped_total",
			Help: "Total number of reconciler events dropped (gave up on), labeled by reason.",
		}, []string{"group", "resource", "reason"}),

		BackfillItemDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "vector_backfill_item_duration_seconds",
			Help:                            "Time (in seconds) to process a single backfill item, labeled by group, resource, and outcome status (including skip reasons).",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "status"}),
	}
}
