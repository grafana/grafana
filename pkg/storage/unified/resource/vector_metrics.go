package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type VectorMetrics struct {
	SearchDuration               *prometheus.HistogramVec
	EmbedDuration                *prometheus.HistogramVec
	RerankDuration               *prometheus.HistogramVec
	RerankCandidatesTotal        *prometheus.CounterVec
	RerankDroppedResultsTotal    *prometheus.CounterVec
	ReconcilerProcessDuration    *prometheus.HistogramVec
	ReconcilerPendingEvents      prometheus.Gauge
	ReconcilerRetriesTotal       *prometheus.CounterVec
	ReconcilerEventsDroppedTotal *prometheus.CounterVec

	ReconcilerSubresourcesExtractedTotal *prometheus.CounterVec
	ReconcilerSubresourcesEmbeddedTotal  *prometheus.CounterVec
	ReconcilerSubresourcesDeletedTotal   *prometheus.CounterVec
	BackfillItemDuration                 *prometheus.HistogramVec
	QueryCacheHitsTotal                  *prometheus.CounterVec
	QueryCacheMissesTotal                *prometheus.CounterVec
	QueryCacheEvictionsTotal             prometheus.Counter
	RateLimitedRequestsTotal             prometheus.Counter
	RateLimiterErrorsTotal               prometheus.Counter
}

func ProvideVectorMetrics(reg prometheus.Registerer) *VectorMetrics {
	return &VectorMetrics{
		SearchDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "vector_storage_search_duration_seconds",
			Help:                            "Time (in seconds) spent serving the VectorSearch RPC, labeled by group, resource, and gRPC status code.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "status_code"}),
		EmbedDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "vector_storage_embed_duration_seconds",
			Help:                            "Time (in seconds) spent in a single TextEmbedder call to the provider (Vertex/Bedrock), labeled by model, task, and status.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"model", "task", "status"}),
		RerankDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "vector_storage_rerank_duration_seconds",
			Help:                            "Time (in seconds) spent in a single rerank Scorer call to the provider (Vertex/Bedrock), labeled by model and status (ok|error|timeout).",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"model", "status"}),
		RerankCandidatesTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_rerank_candidates_total",
			Help: "Total results scored by the reranker, labeled by model. Denominator for the drop proportion: rate(dropped) / rate(candidates).",
		}, []string{"model"}),
		RerankDroppedResultsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_rerank_dropped_results_total",
			Help: "Total HybridSearch results dropped by the min_relevance threshold, labeled by model and requested level.",
		}, []string{"model", "level"}),
		ReconcilerProcessDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "vector_storage_reconciler_process_duration_seconds",
			Help:                            "Time (in seconds) to process a single embedding event in the reconciler, labeled by group, resource, and outcome status.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "status"}),
		ReconcilerPendingEvents: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "vector_storage_reconciler_pending_events",
			Help: "Current number of events pending processing in the embedding reconciler dedup map.",
		}),
		ReconcilerRetriesTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_reconciler_retries_total",
			Help: "Total number of reconciler events re-queued after a failure.",
		}, []string{"group", "resource"}),
		ReconcilerEventsDroppedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_reconciler_events_dropped_total",
			Help: "Total number of reconciler events dropped (gave up on), labeled by reason.",
		}, []string{"group", "resource", "reason"}),
		ReconcilerSubresourcesExtractedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_reconciler_subresources_extracted_total",
			Help: "Total subresources extracted from processed resources. Compare with embedded to see how many re-embeds the content diff avoids.",
		}, []string{"group", "resource"}),
		ReconcilerSubresourcesEmbeddedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_reconciler_subresources_embedded_total",
			Help: "Total subresources re-embedded (new or content-changed). Equal to extracted means the diff is saving nothing.",
		}, []string{"group", "resource"}),
		ReconcilerSubresourcesDeletedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_reconciler_subresources_deleted_total",
			Help: "Total stale subresources deleted because they no longer exist in the resource.",
		}, []string{"group", "resource"}),
		BackfillItemDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "vector_storage_backfill_item_duration_seconds",
			Help:                            "Time (in seconds) to process a single backfill item, labeled by group, resource, and outcome status (including skip reasons).",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "status"}),
		QueryCacheHitsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_query_cache_hits_total",
			Help: "Total number of VectorSearch query-embedding cache hits, labeled by model.",
		}, []string{"model"}),
		QueryCacheMissesTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "vector_storage_query_cache_misses_total",
			Help: "Total number of VectorSearch query-embedding cache misses (i.e. requests that went to the embedder), labeled by model.",
		}, []string{"model"}),
		QueryCacheEvictionsTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "vector_storage_query_cache_evictions_total",
			Help: "Total number of evictions from the query-embedding cache (FIFO by created_at).",
		}),
		RateLimitedRequestsTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "vector_storage_rate_limited_total",
			Help: "Total number of VectorSearch requests rejected by the per-tenant rate limiter.",
		}),
		RateLimiterErrorsTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "vector_storage_rate_limiter_errors_total",
			Help: "Total number of fail-closed VectorSearch rejections caused by the rate-limiter backend being unavailable. Distinct from rate_limited_total (genuine over-quota rejections).",
		}),
	}
}
