package state

import (
	"bytes"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

func TestAlertsMetricCollector_Collect(t *testing.T) {
	tests := []struct {
		name            string
		states          []*State
		expectedMetrics string
	}{
		{
			name: "alerting state should emit firing metric",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Alerting,
					Labels:         data.Labels{"instance": "server1"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
				grafana_alerting_alert_states{alertname="Rule 1",alertstate="firing",grafana_alertstate="alerting",instance="server1",org_id="1",rule_uid="rule1"} 1
			`,
		},
		{
			name: "recovering state should emit firing metric",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Recovering,
					Labels:         data.Labels{"instance": "server1"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
		        grafana_alerting_alert_states{alertname="Rule 1",alertstate="firing",grafana_alertstate="recovering",instance="server1",org_id="1",rule_uid="rule1"} 1
			`,
		},
		{
			name: "pending state should emit pending metric",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Pending,
					Labels:         data.Labels{"instance": "server1"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
                grafana_alerting_alert_states{alertname="Rule 1",alertstate="pending",grafana_alertstate="pending",instance="server1",org_id="1",rule_uid="rule1"} 1
			`,
		},
		{
			name: "normal state should not emit metric",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Normal,
					Labels:         data.Labels{"instance": "server1"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
			`,
		},
		{
			name: "error state should not emit metric",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Error,
					Labels:         data.Labels{"instance": "server1"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
			`,
		},
		{
			name: "should not include internal labels",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Alerting,
					Labels:         data.Labels{"instance": "server1", "__internal__": "value"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
				grafana_alerting_alert_states{alertname="Rule 1",alertstate="firing",grafana_alertstate="alerting",instance="server1",org_id="1",rule_uid="rule1"} 1
			`,
		},
		{
			name: "multiple states with different states should emit multiple metrics",
			states: []*State{
				{
					OrgID:          1,
					AlertRuleUID:   "rule1",
					AlertRuleTitle: "Rule 1",
					CacheID:        data.Fingerprint(123),
					State:          eval.Alerting,
					Labels:         data.Labels{"instance": "server1"},
				},
				{
					OrgID:          1,
					AlertRuleUID:   "rule2",
					AlertRuleTitle: "Rule 2",
					CacheID:        data.Fingerprint(456),
					State:          eval.Pending,
					Labels:         data.Labels{"instance": "server2"},
				},
			},
			expectedMetrics: `
				# HELP grafana_alerting_alert_states Current state of each alert instance (1 for firing, pending or recovering alerts)
				# TYPE grafana_alerting_alert_states gauge
                grafana_alerting_alert_states{alertname="Rule 1",alertstate="firing",grafana_alertstate="alerting",instance="server1",org_id="1",rule_uid="rule1"} 1
                grafana_alerting_alert_states{alertname="Rule 2",alertstate="pending",grafana_alertstate="pending",instance="server2",org_id="1",rule_uid="rule2"} 1
			`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()

			cache := newCache()
			for _, state := range tt.states {
				cache.set(state)
			}

			collector := newAlertsMetricCollector(cache)
			reg.MustRegister(collector)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(tt.expectedMetrics), "grafana_alerting_alert_states")
			require.NoError(t, err)
		})
	}
}
