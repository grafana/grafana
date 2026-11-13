package metrics

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

type API struct {
	RequestDuration *prometheus.HistogramVec
}

func NewAPIMetrics(r prometheus.Registerer) *API {
	requestDuration := metricutil.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "request_duration_seconds",
			Help:      "Histogram of requests to the Alerting API",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"method", "route", "status_code", "backend"},
	)
	// metricutil.NewHistogramVec returns an unregistered collector, so register
	// here. A nil registerer means "do not register", as promauto.With(nil) did.
	if r != nil {
		r.MustRegister(requestDuration)
	}

	return &API{RequestDuration: requestDuration}
}
