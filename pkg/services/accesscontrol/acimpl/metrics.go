package acimpl

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

const exporterName = "grafana"

var (
	// mAccessEngineEvaluationsSeconds is a summary for evaluating access for a specific engine (RBAC and zanzana)
	mAccessEngineEvaluationsSeconds *prometheus.HistogramVec

	// mZanzanaEvaluationStatusTotal is a metric for zanzana evaluation status
	mZanzanaEvaluationStatusTotal *prometheus.CounterVec
)

var once sync.Once

func initMetrics() {
	once.Do(func() {
		mAccessEngineEvaluationsSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:      "access_engine_evaluations_seconds",
			Help:      "Histogram for evaluation time for the specific access control engine (RBAC and zanzana).",
			Namespace: exporterName,
			Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
		},
			[]string{"engine"},
		)

		mZanzanaEvaluationStatusTotal = metricutil.NewCounterVecStartingAtZero(
			prometheus.CounterOpts{
				Name:      "zanzana_evaluation_status_total",
				Help:      "evaluation status (success or error) for zanzana",
				Namespace: exporterName,
			}, []string{"status"}, map[string][]string{"status": {"success", "error"}})

		prometheus.MustRegister(
			mAccessEngineEvaluationsSeconds,
			mZanzanaEvaluationStatusTotal,
		)
	})
}
