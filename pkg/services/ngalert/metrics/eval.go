package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Eval struct {
	Failures *prometheus.CounterVec
	Total    *prometheus.CounterVec

	// QueryDuration is the total time (in seconds) taken to execute any queries
	// and expressions.
	QueryDuration *prometheus.HistogramVec

	// ProcessDuration is the total time (in seconds) taken to process the data
	// frames returned by any queries and expressions.
	ProcessDuration *prometheus.HistogramVec
}

func NewEvalMetrics(r prometheus.Registerer) *Eval {
	return &Eval{
		Failures: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "evaluation_failures_total",
				Help:      "The total number of evaluation failures.",
			},
			[]string{"org"},
		),
		Total: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "evaluations_total",
				Help:      "The total number of evaluations.",
			},
			[]string{"org"},
		),
		QueryDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "evaluation_query_duration_seconds",
				Help:      "The total time taken to execute any queries and expressions.",
				Buckets:   []float64{1, 5, 10, 15, 30, 60, 120, 240},
			},
			[]string{"org"},
		),
		ProcessDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "evaluation_process_duration_seconds",
				Help:      "The total time taken to process the data frames returned by any queries and expressions.",
				Buckets:   []float64{1, 5, 10, 15, 30, 60, 120, 240},
			},
			[]string{"org"},
		),
	}
}
