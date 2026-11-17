package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type API struct {
	RequestDuration *prometheus.HistogramVec
	ConvertRequests *prometheus.CounterVec
}

func NewAPIMetrics(r prometheus.Registerer) *API {
	return &API{
		RequestDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "request_duration_seconds",
				Help:      "Histogram of requests to the Alerting API",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method", "route", "status_code", "backend"},
		),
		ConvertRequests: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "convert_api_requests_total",
				Help:      "Number of import calls to the convert API, by operation, caller and result. Alertmanager dry runs are not counted.",
			},
			[]string{"operation", "source", "result"},
		),
	}
}
