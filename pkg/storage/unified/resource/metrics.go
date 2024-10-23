package resource

import (
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	once                 sync.Once
	StorageServerMetrics *StorageApiMetrics
)

type StorageApiMetrics struct {
	WatchEventLatency *prometheus.HistogramVec
}

func NewStorageMetrics() *StorageApiMetrics {
	once.Do(func() {
		StorageServerMetrics = &StorageApiMetrics{
			WatchEventLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
				Namespace:                       "storage_server",
				Name:                            "watch_latency_seconds",
				Help:                            "Time (in seconds) spent waiting for watch events to be sent",
				Buckets:                         instrument.DefBuckets,
				NativeHistogramBucketFactor:     1.1, // enable native histograms
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}, []string{"resource"}),
		}
	})

	return StorageServerMetrics
}

func (s *StorageApiMetrics) Collect(ch chan<- prometheus.Metric) {
	s.WatchEventLatency.Collect(ch)
}

func (s *StorageApiMetrics) Describe(ch chan<- *prometheus.Desc) {
	s.WatchEventLatency.Describe(ch)
}
