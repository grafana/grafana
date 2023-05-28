package metric

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana"
)

type Metrics struct {
	PublicDashboardsAmount *prometheus.GaugeVec
}

func newMetrics() *Metrics {
	return &Metrics{
		PublicDashboardsAmount: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "public_dashboards_amount",
			Help:      "Total amount of public dashboards",
		}, []string{"is_enabled", "share_type"}),
	}
}
