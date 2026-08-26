package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type API struct {
	RequestDuration        *prometheus.HistogramVec
	ProducerAlertsAccepted *prometheus.CounterVec
	ProducerAlertsRejected *prometheus.CounterVec
	ProducerAlertsResolved *prometheus.CounterVec
	ProducerSourcesActive  *prometheus.GaugeVec
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
		ProducerAlertsAccepted: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace, Subsystem: Subsystem, Name: "producer_alerts_accepted_total",
			Help: "Number of alerts accepted from trusted producers.",
		}, []string{"source"}),
		ProducerAlertsRejected: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace, Subsystem: Subsystem, Name: "producer_alerts_rejected_total",
			Help: "Number of alerts rejected from trusted producers.",
		}, []string{"source"}),
		ProducerAlertsResolved: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace, Subsystem: Subsystem, Name: "producer_alerts_resolved_total",
			Help: "Number of resolved alerts accepted from trusted producers.",
		}, []string{"source"}),
		ProducerSourcesActive: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace, Subsystem: Subsystem, Name: "producer_sources_active",
			Help: "Trusted producer sources that have published alerts in this process.",
		}, []string{"source"}),
	}
}
