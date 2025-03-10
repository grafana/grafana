package resource

import (
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	onceIndex             sync.Once
	onceSprinkles         sync.Once
	IndexMetrics          *BleveIndexMetrics
	SprinklesIndexMetrics *SprinklesMetrics
)

type BleveIndexMetrics struct {
	IndexLatency      *prometheus.HistogramVec
	IndexSize         prometheus.Gauge
	IndexedKinds      *prometheus.GaugeVec
	IndexCreationTime *prometheus.HistogramVec
	IndexTenants      *prometheus.CounterVec
}

type SprinklesMetrics struct {
	SprinklesLatency prometheus.Histogram
}

var IndexCreationBuckets = []float64{1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

func NewSprinklesMetrics() *SprinklesMetrics {
	onceSprinkles.Do(func() {
		SprinklesIndexMetrics = &SprinklesMetrics{
			SprinklesLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
				Namespace:                       "index_server",
				Name:                            "sprinkles_latency_seconds",
				Help:                            "Time (in seconds) it takes until sprinkles are fetched",
				Buckets:                         instrument.DefBuckets,
				NativeHistogramBucketFactor:     1.1, // enable native histograms
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}),
		}
	})

	return SprinklesIndexMetrics
}

func NewIndexMetrics() *BleveIndexMetrics {
	onceIndex.Do(func() {
		IndexMetrics = &BleveIndexMetrics{
			IndexLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
				Namespace:                       "index_server",
				Name:                            "index_latency_seconds",
				Help:                            "Time (in seconds) until index is updated with new event",
				Buckets:                         instrument.DefBuckets,
				NativeHistogramBucketFactor:     1.1, // enable native histograms
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}, []string{"resource"}),
			IndexSize: prometheus.NewGauge(prometheus.GaugeOpts{
				Namespace: "index_server",
				Name:      "index_size",
				Help:      "Size of the index in bytes - only for file-based indices",
			}),
			IndexedKinds: prometheus.NewGaugeVec(prometheus.GaugeOpts{
				Namespace: "index_server",
				Name:      "indexed_kinds",
				Help:      "Number of indexed documents by kind",
			}, []string{"kind"}),
			IndexCreationTime: prometheus.NewHistogramVec(prometheus.HistogramOpts{
				Namespace:                       "index_server",
				Name:                            "index_creation_time_seconds",
				Help:                            "Time (in seconds) it takes until index is created",
				Buckets:                         IndexCreationBuckets,
				NativeHistogramBucketFactor:     1.1, // enable native histograms
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}, []string{}),
			IndexTenants: prometheus.NewCounterVec(prometheus.CounterOpts{
				Namespace: "index_server",
				Name:      "index_tenants",
				Help:      "Number of tenants in the index",
			}, []string{"index_storage"}), // index_storage is either "file" or "memory"
		}
	})

	return IndexMetrics
}

func (s *SprinklesMetrics) Collect(ch chan<- prometheus.Metric) {
	s.SprinklesLatency.Collect(ch)
}

func (s *SprinklesMetrics) Describe(ch chan<- *prometheus.Desc) {
	s.SprinklesLatency.Describe(ch)
}

func (s *BleveIndexMetrics) Collect(ch chan<- prometheus.Metric) {
	s.IndexLatency.Collect(ch)
	s.IndexCreationTime.Collect(ch)
	s.IndexedKinds.Collect(ch)
	s.IndexTenants.Collect(ch)
	s.IndexSize.Collect(ch)
}

func (s *BleveIndexMetrics) Describe(ch chan<- *prometheus.Desc) {
	s.IndexLatency.Describe(ch)
	s.IndexSize.Describe(ch)
	s.IndexedKinds.Describe(ch)
	s.IndexCreationTime.Describe(ch)
	s.IndexTenants.Describe(ch)
}
