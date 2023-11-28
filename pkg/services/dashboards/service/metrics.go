package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "dashboards"
)

func newDashboardsMetrics(r prometheus.Registerer) *dashboardsMetrics {
	m := &dashboardsMetrics{
		sharedWithMeFetchDashboardsSuccessRequestsDuration: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:      "sharedwithme_fetch_dashboards_successes_duration_seconds",
				Help:      "Histogram of fetching dashboards with permissions directly assigned to user",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			}),
	}

	if r != nil {
		r.MustRegister(m.sharedWithMeFetchDashboardsSuccessRequestsDuration)
	}

	return m
}

type dashboardsMetrics struct {
	sharedWithMeFetchDashboardsSuccessRequestsDuration prometheus.Histogram
}
