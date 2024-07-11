package resource

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	once                 sync.Once
	StorageServerMetrics *StorageApiMetrics
)

type StorageApiMetrics struct {
	OptimisticLockFailed *prometheus.CounterVec
}

func NewStorageMetrics() *StorageApiMetrics {
	once.Do(func() {
		StorageServerMetrics = &StorageApiMetrics{
			OptimisticLockFailed: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "resource_storage",
					Name:      "optimistic_lock_failed",
					Help:      "count of optimistic locks failed",
				},
				[]string{"action"},
			),
		}
	})

	return StorageServerMetrics
}

func (s *StorageApiMetrics) Collect(ch chan<- prometheus.Metric) {
	s.OptimisticLockFailed.Collect(ch)
}

func (s *StorageApiMetrics) Describe(ch chan<- *prometheus.Desc) {
	s.OptimisticLockFailed.Describe(ch)
}
