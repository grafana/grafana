package acimpl

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "authz"
	metricsNamespace = "grafana"
)

type acMetrics struct {
	// mAccessEngineEvaluationsSeconds is a summary for evaluating access for a specific engine (RBAC and zanzana)
	mAccessEngineEvaluationsSeconds *prometheus.HistogramVec
}

var once sync.Once

// TODO: use prometheus.Registerer
func initMetrics() *acMetrics {
	m := &acMetrics{}
	once.Do(func() {
		m.mAccessEngineEvaluationsSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:      "engine_evaluations_seconds",
			Help:      "Histogram for evaluation time for the specific access control engine (RBAC and zanzana).",
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
		},
			[]string{"engine"},
		)
	})
	return m
}
