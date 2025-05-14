package service

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "dashboards"
)

var defaultBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25}

type dashboardsMetrics struct {
	sharedWithMeFetchDashboardsRequestsDuration *prometheus.HistogramVec
	searchRequestsDuration                      *prometheus.HistogramVec
	searchRequestStatusTotal                    *prometheus.CounterVec
}

func newDashboardsMetrics(r prometheus.Registerer) *dashboardsMetrics {
	return &dashboardsMetrics{
		sharedWithMeFetchDashboardsRequestsDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "sharedwithme_fetch_dashboards_duration_seconds",
				Help:      "Duration of fetching dashboards with permissions directly assigned to user",
				Buckets:   defaultBuckets,
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"status"},
		),
		searchRequestsDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "search_dashboards_duration_seconds",
				Help:      "Duration of dashboards search (by authorization engine)",
				Buckets:   defaultBuckets,
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"engine"},
		),

		searchRequestStatusTotal: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Name:      "search_dashboards_status_total",
				Help:      "Search status (success or error) for zanzana",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"status"},
		),
	}
}
