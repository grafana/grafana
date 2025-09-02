package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BleveIndexMetrics struct {
	IndexLatency         *prometheus.HistogramVec
	IndexSize            prometheus.Gauge
	IndexedKinds         *prometheus.GaugeVec
	IndexCreationTime    *prometheus.HistogramVec
	OpenIndexes          *prometheus.GaugeVec
	IndexBuilds          *prometheus.CounterVec
	IndexBuildFailures   prometheus.Counter
	IndexBuildSkipped    prometheus.Counter
	UpdateLatency        prometheus.Histogram
	UpdatedDocuments     prometheus.Summary
	SearchUpdateWaitTime *prometheus.HistogramVec
}

var IndexCreationBuckets = []float64{1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

func ProvideIndexMetrics(reg prometheus.Registerer) *BleveIndexMetrics {
	m := &BleveIndexMetrics{
		IndexLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_index_latency_seconds",
			Help:                            "Time (in seconds) until index is updated with new event",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
		IndexSize: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "index_server_index_size",
			Help: "Size of the index in bytes - only for file-based indices",
		}),
		IndexedKinds: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "index_server_indexed_kinds",
			Help: "Number of indexed documents by kind",
		}, []string{"kind"}),
		IndexCreationTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_index_build_time_seconds",
			Help:                            "Time it takes to successfully build an index. Failed or skipped builds are not counted.",
			Buckets:                         IndexCreationBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{}),
		OpenIndexes: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "index_server_open_indexes",
			Help: "Number of open indexes per storage type. An open index corresponds to single resource group.",
		}, []string{"index_storage"}), // index_storage is either "file" or "memory"
		IndexBuilds: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_index_build_total",
			Help: "Number of times index build was attempted due to specific reason",
		}, []string{"reason"}),
		IndexBuildFailures: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "index_server_index_build_failures_total",
			Help: "Number of times index build failed",
		}),
		IndexBuildSkipped: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "index_server_index_build_skipped_total",
			Help: "Number of times index build has been skipped due to existing valid index being found on disk",
		}),
		UpdateLatency: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "index_server_update_latency_seconds",
			Help:                            "Time to execute index update with latest modifications",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		UpdatedDocuments: promauto.With(reg).NewSummary(prometheus.SummaryOpts{
			Name: "index_server_update_documents",
			Help: "Number of documents indexed during index update",
		}),
		SearchUpdateWaitTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_search_update_wait_time_seconds",
			Help:                            "Time spent waiting for index update during search queries",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"reason"}),
	}

	// Initialize labels.
	m.OpenIndexes.WithLabelValues("file").Set(0)
	m.OpenIndexes.WithLabelValues("memory").Set(0)
	return m
}
