package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana"
	subsystem = "cloudmigrations"
)

var promMetrics = []prometheus.Collector{
	prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "datasources_migrated",
		Help:      "Total amount of data sources migrated",
	}, []string{"pdc_converted"}),
}
