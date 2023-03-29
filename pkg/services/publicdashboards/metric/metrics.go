package metric

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	namespace = "grafana"
)

type Metrics struct {
	PublicDashboardsTotal *prometheus.GaugeVec
}

func NewMetrics() *Metrics {
	return &Metrics{
		PublicDashboardsTotal: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "public_dashboards_total",
			Help:      "Total count of public dashboards",
		}, []string{"is_enabled", "share_type"}),
	}
}
