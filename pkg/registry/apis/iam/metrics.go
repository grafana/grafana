package iam

import (
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "apiserver"
)

var (
	registerOnce       sync.Once
	hooksWaitHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_wait_duration_seconds",
		Help:      "Time spent in the hooks waiting for a ticket to start processing",
		Buckets:   prometheus.ExponentialBuckets(0.001, 2, 5), // 1ms to ~16s
	}, []string{"resource_type", "operation"})

	// hooksDurationHistogram tracks the total duration of hook operations
	hooksDurationHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_operation_duration_seconds",
		Help:      "Time spent executing hook operations (create, update, delete)",
		Buckets:   prometheus.ExponentialBuckets(0.001, 2, 10), // 1ms to ~1s
	}, []string{"resource_type", "operation", "status"})

	// hooksOperationCounter tracks the number of hook operations
	hooksOperationCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_operations_total",
		Help:      "Total number of hook operations by resource type, operation, and status",
	}, []string{"resource_type", "operation", "status"})

	// hooksTuplesCounter tracks the number of tuples written/deleted
	hooksTuplesCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_tuples_total",
		Help:      "Total number of tuples written or deleted by resource type and operation type",
	}, []string{"resource_type", "operation", "action"})
)

func registerMetrics(reg prometheus.Registerer) {
	registerOnce.Do(func() {
		metrics := []prometheus.Collector{
			hooksWaitHistogram,
			hooksDurationHistogram,
			hooksOperationCounter,
			hooksTuplesCounter,
		}

		for _, metric := range metrics {
			if err := reg.Register(metric); err != nil {
				log.New("iam.apis").Warn("failed to register iam apiserver metrics", "error", err)
			}
		}
	})
}
