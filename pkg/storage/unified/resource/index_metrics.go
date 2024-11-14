package resource

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	onceIndex          sync.Once
	IndexServerMetrics *IndexMetrics
)

type IndexMetrics struct {
	IndexDir    string
	IndexServer *IndexServer

	// metrics
	IndexLatency      *prometheus.HistogramVec
	IndexSize         prometheus.Gauge
	IndexedDocs       prometheus.Gauge
	IndexedKinds      *prometheus.CounterVec
	IndexCreationTime *prometheus.HistogramVec
}

var IndexCreationBuckets = []float64{1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

func NewIndexMetrics(indexDir string, indexServer *IndexServer) *IndexMetrics {
	onceIndex.Do(func() {
		IndexServerMetrics = &IndexMetrics{
			IndexDir:    indexDir,
			IndexServer: indexServer,
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
				Help:      "Size of the index in bytes",
			}),
			IndexedDocs: prometheus.NewGauge(prometheus.GaugeOpts{
				Namespace: "index_server",
				Name:      "indexed_docs",
				Help:      "Number of indexed documents by resource",
			}),
			IndexedKinds: prometheus.NewCounterVec(prometheus.CounterOpts{
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
		}
	})

	return IndexServerMetrics
}

func (s *IndexMetrics) Collect(ch chan<- prometheus.Metric) {
	s.IndexLatency.Collect(ch)
	s.IndexCreationTime.Collect(ch)
	s.IndexedKinds.Collect(ch)

	// collect index size
	totalSize, err := getTotalIndexSize(s.IndexDir)
	if err == nil {
		s.IndexSize.Set(float64(totalSize))
		s.IndexSize.Collect(ch)
	}

	// collect index docs
	s.IndexedDocs.Set(getTotalDocCount(s.IndexServer.index))
	s.IndexedDocs.Collect(ch)
}

func (s *IndexMetrics) Describe(ch chan<- *prometheus.Desc) {
	s.IndexLatency.Describe(ch)
	s.IndexSize.Describe(ch)
	s.IndexedDocs.Describe(ch)
	s.IndexedKinds.Describe(ch)
	s.IndexCreationTime.Describe(ch)
}

// getTotalDocCount returns the total number of documents in the index
func getTotalDocCount(index *Index) float64 {
	count, _ := index.Count()
	return float64(count)
}

// getTotalIndexSize returns the total size of the index directory when using a file-based index
func getTotalIndexSize(dir string) (int64, error) {
	var totalSize int64

	err := filepath.WalkDir(dir, func(path string, info os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			fileInfo, err := info.Info()
			if err != nil {
				return err
			}
			totalSize += fileInfo.Size()
		}
		return nil
	})

	return totalSize, err
}
