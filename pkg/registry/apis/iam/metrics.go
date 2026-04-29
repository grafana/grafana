package iam

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "apiserver"
)

// DefaultWriteTimeout is the default timeout for Zanzana write operations.
// Exported for use by enterprise hooks.
const DefaultWriteTimeout = 15 * time.Second

var (
	registerOnce sync.Once

	// HooksWaitHistogram tracks the time spent waiting for a ticket to start processing.
	// Exported for use by enterprise hooks.
	HooksWaitHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_wait_duration_seconds",
		Help:      "Time spent in the hooks waiting for a ticket to start processing",
		Buckets:   prometheus.ExponentialBuckets(0.001, 2, 5), // 1ms to ~16s
	}, []string{"resource_type", "operation"})

	// HooksDurationHistogram tracks the total duration of hook operations.
	// Exported for use by enterprise hooks.
	HooksDurationHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_operation_duration_seconds",
		Help:      "Time spent executing hook operations (create, update, delete)",
		Buckets:   prometheus.ExponentialBuckets(0.001, 2, 10), // 1ms to ~1s
	}, []string{"resource_type", "operation", "status"})

	// HooksOperationCounter tracks the number of hook operations.
	// Exported for use by enterprise hooks.
	HooksOperationCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_operations_total",
		Help:      "Total number of hook operations by resource type, operation, and status",
	}, []string{"resource_type", "operation", "status"})

	// HooksTuplesCounter tracks the number of tuples written/deleted.
	// Exported for use by enterprise hooks.
	HooksTuplesCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_tuples_total",
		Help:      "Total number of tuples written or deleted by resource type and operation type",
	}, []string{"resource_type", "operation", "action"})

	// PermissionLatencyHistogram tracks duration spent in each resource-permission request layer.
	PermissionLatencyHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "permission_layer_duration_seconds",
		Help:      "Latency of resource-permission operations broken down by layer, operation, resource and status.",
		Buckets:   prometheus.ExponentialBuckets(0.001, 2, 12), // 1ms to ~4s
	}, []string{"layer", "operation", "resource", "status"})
)

func registerMetrics(reg prometheus.Registerer) {
	registerOnce.Do(func() {
		metrics := []prometheus.Collector{
			HooksWaitHistogram,
			HooksDurationHistogram,
			HooksOperationCounter,
			HooksTuplesCounter,
			PermissionLatencyHistogram,
		}

		for _, metric := range metrics {
			if err := reg.Register(metric); err != nil {
				log.New("iam.apis").Warn("failed to register iam apiserver metrics", "error", err)
			}
		}
	})
}
