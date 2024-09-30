package metrics

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/prometheus/alertmanager/api/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

type Alertmanager struct {
	Registerer prometheus.Registerer
	*metrics.Alerts
	*AlertmanagerConfigMetrics
}

// NewAlertmanagerMetrics creates a set of metrics for the Alertmanager of each organization.
func NewAlertmanagerMetrics(r prometheus.Registerer, l log.Logger) *Alertmanager {
	other := prometheus.WrapRegistererWithPrefix(fmt.Sprintf("%s_%s_", Namespace, Subsystem), r)
	return &Alertmanager{
		Registerer:                r,
		Alerts:                    metrics.NewAlerts(other, l),
		AlertmanagerConfigMetrics: NewAlertmanagerConfigMetrics(r, l),
	}
}

type AlertmanagerConfigMetrics struct {
	ConfigHash      *prometheus.GaugeVec
	ConfigSizeBytes *prometheus.GaugeVec
	Matchers        prometheus.Gauge
	MatchRE         prometheus.Gauge
	Match           prometheus.Gauge
	ObjectMatchers  prometheus.Gauge
}

func NewAlertmanagerConfigMetrics(r prometheus.Registerer, l log.Logger) *AlertmanagerConfigMetrics {
	m := &AlertmanagerConfigMetrics{
		ConfigHash: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "alertmanager_config_hash",
			Help: "The hash of the Alertmanager configuration.",
		}, []string{"org"}),
		ConfigSizeBytes: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "alertmanager_config_size_bytes",
			Help: "The size of the grafana alertmanager configuration in bytes",
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
		for _, c := range []prometheus.Collector{m.ConfigHash, m.ConfigSizeBytes, m.Matchers, m.MatchRE, m.Match, m.ObjectMatchers} {
			// simpler than handling prometheus.AlreadyRegisteredError and replacing collectors
			r.Unregister(c)

			if err := r.Register(c); err != nil {
				l.Error("Error registering prometheus collector for new alertmanager", "error", err)
			}
		}
	}
	return m
}
