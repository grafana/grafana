package dashboards

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	DashboardValidationCounter *prometheus.CounterVec
	DashboardValidationHist    *prometheus.HistogramVec
)

func init() {
	DashboardValidationCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "dashboard_validation_stats",
			Help:      "A counter for dashboard validation",
		},
		[]string{"status"},
	)

	DashboardValidationHist = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "dashboard_validation_seconds",
		Help:      "Dashboard validation histogram",
		Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
	}, []string{"status"})

	prometheus.MustRegister(DashboardValidationHist)
}
