package sqlstash

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	once                 sync.Once
	StorageServerMetrics *StorageApiMetrics
)

type StorageApiMetrics struct {
	Lists   prometheus.Counter
	Creates *prometheus.CounterVec
}

func NewStorageMetrics() *StorageApiMetrics {
	once.Do(func() {
		StorageServerMetrics = &StorageApiMetrics{
			Lists: prometheus.NewCounter(prometheus.CounterOpts{
				Namespace: "storage_server",
				Name:      "list_ops",
				Help:      "count of list operations",
			}),
			Creates: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "storage_server",
					Name:      "create_calls",
					Help:      "count of create operations",
				},
				[]string{"someLabel"},
			),
		}
	})

	return StorageServerMetrics
}

func (s *StorageApiMetrics) Collect(ch chan<- prometheus.Metric) {
	s.Lists.Collect(ch)
	s.Creates.Collect(ch)
}

func (s *StorageApiMetrics) Describe(ch chan<- *prometheus.Desc) {
	s.Lists.Describe(ch)
	s.Creates.Describe(ch)
}
