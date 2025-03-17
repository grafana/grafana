package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type storageMetrics struct {
	watchEventLatency *prometheus.HistogramVec
}

func newStorageMetrics(reg prometheus.Registerer) *storageMetrics {
	return &storageMetrics{
		watchEventLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "watch_latency_seconds",
			Help:                            "Time (in seconds) spent waiting for watch events to be sent",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
	}
}
