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
			[]string{"method", "namespace"},
		),
	}
}
