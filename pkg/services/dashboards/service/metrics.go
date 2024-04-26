package service

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "dashboards"
)

type dashboardsMetrics struct {
	sharedWithMeFetchDashboardsRequestsDuration *prometheus.HistogramVec
}

func newDashboardsMetrics(r prometheus.Registerer) *dashboardsMetrics {
	return &dashboardsMetrics{
		sharedWithMeFetchDashboardsRequestsDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "sharedwithme_fetch_dashboards_duration_seconds",
				Help:      "Duration of fetching dashboards with permissions directly assigned to user",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"status"},
		),
	}
}
