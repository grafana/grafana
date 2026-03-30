package datasource

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	dsSubresourceRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "ds_apiserver",
			Name:      "subresource_requests_total",
			Help:      "Total datasource subresource Connect calls by endpoint, plugin, and outcome.",
		},
		[]string{"endpoint", "plugin_id", "status"},
	)

	dsSubresourceRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "ds_apiserver",
			Name:      "subresource_request_duration_seconds",
			Help:      "Duration of datasource subresource Connect calls by endpoint and plugin.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"endpoint", "plugin_id"},
	)
)

func registerSubresourceMetrics(reg prometheus.Registerer) {
	for _, c := range []prometheus.Collector{dsSubresourceRequests, dsSubresourceRequestDuration} {
		if err := reg.Register(c); err != nil {
			if _, ok := err.(prometheus.AlreadyRegisteredError); !ok {
				panic(err)
			}
		}
	}
}
