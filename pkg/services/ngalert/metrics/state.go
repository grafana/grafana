package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type State struct {
	GroupRules *prometheus.GaugeVec
	AlertState *prometheus.GaugeVec
}

func NewStateMetrics(r prometheus.Registerer) *State {
	return &State{
		// TODO: once rule groups support multiple rules, consider partitioning
		// on rule group as well as tenant, similar to loki|cortex.
		GroupRules: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_group_rules",
				Help:      "The number of rules.",
			},
			[]string{"org"},
		),
		AlertState: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "alerts",
			Help:      "How many alerts by state.",
		}, []string{"state"}),
	}
}
