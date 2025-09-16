package client

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "authz_zanzana"
)

type metrics struct {
	// evaluationsSeconds is a summary for evaluating access for a specific engine (RBAC and zanzana)
	evaluationsSeconds *prometheus.HistogramVec
	// compileSeconds is a summary for compiling item checker for a specific engine (RBAC and zanzana)
	compileSeconds *prometheus.HistogramVec
	// evaluationStatusTotal is a metric for zanzana evaluation status
	evaluationStatusTotal *prometheus.CounterVec
}

func newShadowClientMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		evaluationsSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "engine_evaluations_seconds",
				Help:      "Histogram for evaluation time for the specific access control engine (RBAC and zanzana).",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
			},
			[]string{"engine"},
		),
		compileSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "compile_seconds",
				Help:      "Histogram for item checker compilation time for the specific access control engine (RBAC and zanzana).",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
			},
			[]string{"engine"},
		),
		evaluationStatusTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name:      "evaluation_status_total",
				Help:      "evaluation status (success or error) for zanzana",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"status"},
		),
	}
}
