package state

import (
	"fmt"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

const (
	alertStateLabel        = "alertstate"
	grafanaAlertStateLabel = "grafana_alertstate"
	alertRuleUIDLabel      = "rule_uid"
	alertRuleTitleLabel    = "alertname"
	orgIDLabel             = "org_id"
)

type alertsMetricCollector struct {
	cache *cache
}

func newAlertsMetricCollector(c *cache) *alertsMetricCollector {
	return &alertsMetricCollector{
		cache: c,
	}
}

func (ac *alertsMetricCollector) Describe(ch chan<- *prometheus.Desc) {
}

func (ac *alertsMetricCollector) Collect(ch chan<- prometheus.Metric) {
	ac.cache.mtxStates.RLock()
	defer ac.cache.mtxStates.RUnlock()

	for _, orgMap := range ac.cache.states {
		for _, rule := range orgMap {
			for _, st := range rule.states {
				promState := promState(st.State)
				if promState == "" {
					continue
				}

				labels := buildLabels(st, promState)
				desc := prometheus.NewDesc(
					prometheus.BuildFQName(metrics.Namespace, metrics.Subsystem, "alert_states"),
					"Current state of each alert instance (1 for firing, pending or recovering alerts)",
					nil,
					labels,
				)

				ch <- prometheus.MustNewConstMetric(desc, prometheus.GaugeValue, 1)
			}
		}
	}
}

func promState(s eval.State) string {
	switch s {
	case eval.Alerting, eval.Recovering:
		return "firing"
	case eval.Pending:
		return "pending"
	default:
		return ""
	}
}

func buildLabels(st *State, promState string) prometheus.Labels {
	lbls := prometheus.Labels{
		alertRuleTitleLabel:    st.AlertRuleTitle,
		alertStateLabel:        promState,
		grafanaAlertStateLabel: strings.ToLower(st.State.String()),
		alertRuleUIDLabel:      st.AlertRuleUID,
		orgIDLabel:             fmt.Sprintf("%d", st.OrgID),
	}

	for k, v := range st.Labels {
		if strings.HasPrefix(k, "__") && strings.HasSuffix(k, "__") {
			// Skip internal Grafana labels
			continue
		}
		lbls[k] = v
	}

	return lbls
}
