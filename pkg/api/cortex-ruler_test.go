package api

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func Test_Rule_Marshaling(t *testing.T) {
	for _, tc := range []struct {
		desc  string
		input ExtendedRuleNode
		err   bool
	}{
		{
			desc: "success lotex",
			input: ExtendedRuleNode{
				ApiRuleNode: &ApiRuleNode{},
			},
		},
		{
			desc: "success grafana",
			input: ExtendedRuleNode{
				GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
			},
		},
		{
			desc: "failure mixed",
			input: ExtendedRuleNode{
				ApiRuleNode:         &ApiRuleNode{},
				GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
			},
			err: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out ExtendedRuleNode
			err = json.Unmarshal(encoded, &out)

			if tc.err {
				require.Error(t, err)
			} else {
				require.Nil(t, err)
				require.Equal(t, tc.input, out)
			}
		})
	}
}

func Test_Rule_Group_Marshaling(t *testing.T) {
	for _, tc := range []struct {
		desc  string
		input RuleGroupConfig
		err   bool
	}{
		{
			desc: "success lotex",
			input: RuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []ExtendedRuleNode{
					ExtendedRuleNode{
						ApiRuleNode: &ApiRuleNode{},
					},
					ExtendedRuleNode{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
		},
		{
			desc: "success grafana",
			input: RuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []ExtendedRuleNode{
					ExtendedRuleNode{
						GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
					},
					ExtendedRuleNode{
						GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
					},
				},
			},
		},
		{
			desc: "failure mixed",
			input: RuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []ExtendedRuleNode{
					ExtendedRuleNode{
						GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
					},
					ExtendedRuleNode{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
			err: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out RuleGroupConfig
			err = json.Unmarshal(encoded, &out)

			if tc.err {
				require.Error(t, err)
			} else {
				require.Nil(t, err)
				require.Equal(t, tc.input, out)
			}
		})
	}
}

func Test_Rule_Group_Type(t *testing.T) {
	for _, tc := range []struct {
		desc     string
		input    RuleGroupConfig
		expected Backend
	}{
		{
			desc: "success lotex",
			input: RuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []ExtendedRuleNode{
					ExtendedRuleNode{
						ApiRuleNode: &ApiRuleNode{},
					},
					ExtendedRuleNode{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
			expected: LoTexRulerBackend,
		},
		{
			desc: "success grafana",
			input: RuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []ExtendedRuleNode{
					ExtendedRuleNode{
						GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
					},
					ExtendedRuleNode{
						GrafanaManagedAlert: &ExtendedUpsertAlertDefinitionCommand{},
					},
				},
			},
			expected: GrafanaBackend,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.expected, tc.input.Type())
		})
	}
}

func TestNamespaceMarshalling(t *testing.T) {
	var data = `copy:
    - name: loki_alerts
      rules:
        - alert: logs_exist
          expr: rate({cluster="us-central1", job="loki-prod/loki-canary"}[1m]) > 0
          for: 1m
simple_rules:
    - name: loki_alerts
      rules:
        - alert: logs_exist
          expr: rate({cluster="us-central1", job="loki-prod/loki-canary"}[1m]) > 0
          for: 1m
`

	var res NamespaceConfigResponse

	err := yaml.Unmarshal([]byte(data), &res)
	require.Nil(t, err)
	b, err := yaml.Marshal(res)
	require.Nil(t, err)
	require.Equal(t, data, string(b))

}
