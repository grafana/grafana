package repository

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// OperationMetrics tracks every operation performed against a repository
// (read, write, delete, move, tree listing) — regardless of which caller
// (job execution, the files API, the parser, the authorizer, sync
// compare/diff, ...) performs it: size (where there is a byte payload),
// duration, and outcome.
type OperationMetrics struct {
	sizeHist     *prometheus.HistogramVec // operation
	durationHist *prometheus.HistogramVec // operation
	opsTotal     *prometheus.CounterVec   // operation, outcome
}

var (
	operationMetricsOnce sync.Once
	operationMetrics     *OperationMetrics
)

// RegisterOperationMetrics registers the repository operation metrics.
func RegisterOperationMetrics(reg prometheus.Registerer) *OperationMetrics {
	operationMetricsOnce.Do(func() {
		sizeHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_provisioning_repository_operation_size_bytes",
				Help: "Size in bytes of repository operations that carry a byte payload (read, write)",
				// 128B -> 64MB. Deliberately well above ProvisioningMaxFileSizeDefault (5MiB)
				// so the configured cap sits mid-histogram instead of at the +Inf edge.
				Buckets: prometheus.ExponentialBuckets(128, 2, 20),
			},
			[]string{"operation"},
		)
		reg.MustRegister(sizeHist)

		durationHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_repository_operation_duration_seconds",
				Help:    "Duration of repository operations",
				Buckets: prometheus.ExponentialBucketsRange(0.001, 30, 10), // 1ms -> 30s
			},
			[]string{"operation"},
		)
		reg.MustRegister(durationHist)

		opsTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_repository_operations_total",
				Help: "Total repository operations, by outcome",
			},
			[]string{"operation", "outcome"},
		)
		reg.MustRegister(opsTotal)

		operationMetrics = &OperationMetrics{
			sizeHist:     sizeHist,
			durationHist: durationHist,
			opsTotal:     opsTotal,
		}
	})
	return operationMetrics
}

// RecordRead observes a repository read: its duration, outcome, and (on
// success) the size of the data read.
func (m *OperationMetrics) RecordRead(sizeBytes int, duration time.Duration, err error) {
	m.recordSize("read", sizeBytes, duration, err)
}

// RecordWrite observes a repository write: its duration, outcome, and (on
// success) the size of the data written.
func (m *OperationMetrics) RecordWrite(sizeBytes int, duration time.Duration, err error) {
	m.recordSize("write", sizeBytes, duration, err)
}

// RecordOperation observes a repository operation with no byte payload
// (delete, move, tree listing): duration and outcome only.
func (m *OperationMetrics) RecordOperation(operation string, duration time.Duration, err error) {
	m.recordOutcome(operation, duration, err)
}

func (m *OperationMetrics) recordSize(operation string, sizeBytes int, duration time.Duration, err error) {
	if m == nil {
		return
	}
	m.recordOutcome(operation, duration, err)
	// Size is only meaningful once the data is actually known good; a failed
	// read/write has no reliable size and would otherwise skew the low end of
	// the histogram with zeroes.
	if err == nil && m.sizeHist != nil {
		m.sizeHist.WithLabelValues(operation).Observe(float64(sizeBytes))
	}
}

func (m *OperationMetrics) recordOutcome(operation string, duration time.Duration, err error) {
	if m == nil {
		return
	}

	outcome := "success"
	if err != nil {
		outcome = "error"
	}

	if m.opsTotal != nil {
		m.opsTotal.WithLabelValues(operation, outcome).Inc()
	}
	if m.durationHist != nil {
		m.durationHist.WithLabelValues(operation).Observe(duration.Seconds())
	}
}
