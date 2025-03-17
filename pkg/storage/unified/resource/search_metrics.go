package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type searchMetrics struct {
	indexLatency      *prometheus.HistogramVec
	indexedKinds      *prometheus.GaugeVec
	indexCreationTime *prometheus.HistogramVec
}

var searchMetricsCreationBuckets = []float64{1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

func newSearchMetrics(reg prometheus.Registerer) *searchMetrics {
	return &searchMetrics{
		indexLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "index_server",
			Name:                            "index_latency_seconds",
			Help:                            "Time (in seconds) until index is updated with new event",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
		indexedKinds: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "index_server",
			Name:      "indexed_kinds",
			Help:      "Number of indexed documents by kind",
		}, []string{"kind"}),
		indexCreationTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "index_server",
			Name:                            "index_creation_time_seconds",
			Help:                            "Time (in seconds) it takes until index is created",
			Buckets:                         searchMetricsCreationBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{}),
	}
}
