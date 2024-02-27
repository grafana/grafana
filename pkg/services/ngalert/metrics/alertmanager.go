package metrics

import (
	"fmt"

	"github.com/prometheus/alertmanager/api/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

type Alertmanager struct {
	Registerer prometheus.Registerer
	*metrics.Alerts
	*AlertmanagerConfigMetrics
}

// NewAlertmanagerMetrics creates a set of metrics for the Alertmanager of each organization.
func NewAlertmanagerMetrics(r prometheus.Registerer) *Alertmanager {
	other := prometheus.WrapRegistererWithPrefix(fmt.Sprintf("%s_%s_", Namespace, Subsystem), r)
	return &Alertmanager{
		Registerer:                r,
		Alerts:                    metrics.NewAlerts(other),
		AlertmanagerConfigMetrics: NewAlertmanagerConfigMetrics(r),
	}
}

type AlertmanagerConfigMetrics struct {
	ConfigHash     *prometheus.GaugeVec
	Matchers       prometheus.Gauge
	MatchRE        prometheus.Gauge
	Match          prometheus.Gauge
	ObjectMatchers prometheus.Gauge
}

func NewAlertmanagerConfigMetrics(r prometheus.Registerer) *AlertmanagerConfigMetrics {
	m := &AlertmanagerConfigMetrics{
		ConfigHash: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "alertmanager_config_hash",
			Help: "The hash of the Alertmanager configuration.",
		}, []string{"org"}),
		Matchers: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "alertmanager_config_matchers",
			Help: "The total number of matchers",
		}),
		MatchRE: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "alertmanager_config_match_re",
			Help: "The total number of matche_re",
		}),
		Match: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "alertmanager_config_match",
			Help: "The total number of match",
		}),
		ObjectMatchers: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "alertmanager_config_object_matchers",
			Help: "The total number of object_matchers",
		}),
	}
	if r != nil {
		r.MustRegister(m.ConfigHash, m.Matchers, m.MatchRE, m.Match, m.ObjectMatchers)
	}
	return m
}
