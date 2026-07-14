package server

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "authz_zanzana_server"
)

type metrics struct {
	// requestDurationSeconds is a summary for zanzana server request duration
	requestDurationSeconds *prometheus.HistogramVec
	// batchCheckPhaseDurationSeconds measures the duration of each batch check phase
	batchCheckPhaseDurationSeconds *prometheus.HistogramVec
	// inflightRequests tracks current in-flight requests by method
	inflightRequests *prometheus.GaugeVec
	// rejectedRequests counts requests rejected by the concurrency limiter
	rejectedRequests *prometheus.CounterVec
}

func newZanzanaServerMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		requestDurationSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "request_duration_seconds",
				Help:      "Histogram for zanzana server request duration",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
			},
			[]string{"method"},
		),
		batchCheckPhaseDurationSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "batch_check_phase_duration_seconds",
				Help:      "Histogram for batch check phase duration",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
			},
			[]string{"phase"},
		),
		inflightRequests: promauto.With(reg).NewGaugeVec(
			prometheus.GaugeOpts{
				Name:      "inflight_requests",
				Help:      "Current number of in-flight requests",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"method"},
		),
		rejectedRequests: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name:      "rejected_requests_total",
				Help:      "Total requests rejected by the concurrency limiter",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"method", "limiter"},
		),
	}
}
