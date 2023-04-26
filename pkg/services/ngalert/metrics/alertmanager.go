package metrics

import (
	"fmt"

	"github.com/prometheus/alertmanager/api/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

type Alertmanager struct {
	Registerer prometheus.Registerer
	*metrics.Alerts
}

// NewAlertmanagerMetrics creates a set of metrics for the Alertmanager of each organization.
func NewAlertmanagerMetrics(r prometheus.Registerer) *Alertmanager {
	return &Alertmanager{
		Registerer: r,
		Alerts:     metrics.NewAlerts("grafana", prometheus.WrapRegistererWithPrefix(fmt.Sprintf("%s_%s_", Namespace, Subsystem), r)),
	}
}
