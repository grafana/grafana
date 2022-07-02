package definitions

import (
	"encoding/json"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func Test_Rule_Marshaling(t *testing.T) {
	dur, err := model.ParseDuration("1m")
	require.NoError(t, err)

	for _, tc := range []struct {
		desc  string
		input PostableExtendedRuleNode
		err   bool
	}{
		{
			desc: "success lotex",
			input: PostableExtendedRuleNode{
				ApiRuleNode: &ApiRuleNode{},
			},
		},
		{
			desc: "success grafana",
			input: PostableExtendedRuleNode{
				GrafanaManagedAlert: &PostableGrafanaRule{},
			},
		},
		{
			desc: "failure mixed with alert lotex rule",
			input: PostableExtendedRuleNode{
				ApiRuleNode:         &ApiRuleNode{Expr: "<string>"},
				GrafanaManagedAlert: &PostableGrafanaRule{},
			},
			err: true,
		},
		{
			desc: "failure mixed with record lotex rule",
			input: PostableExtendedRuleNode{
				ApiRuleNode:         &ApiRuleNode{Record: "<string>"},
				GrafanaManagedAlert: &PostableGrafanaRule{},
			},
			err: true,
		},
		{
			desc: "grafana with for, annotation and label properties",
			input: PostableExtendedRuleNode{
				ApiRuleNode: &ApiRuleNode{
					For:         &dur,
					Annotations: map[string]string{"foo": "bar"},
					Labels:      map[string]string{"label1": "val1"}},
				GrafanaManagedAlert: &PostableGrafanaRule{},
			},
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out PostableExtendedRuleNode
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
	dur, err := model.ParseDuration("1m")
	require.NoError(t, err)

	for _, tc := range []struct {
		desc  string
		input PostableRuleGroupConfig
		err   bool
	}{
		{
			desc: "success lotex",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						ApiRuleNode: &ApiRuleNode{},
					},
					{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
		},
		{
			desc: "success federated lotex",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						ApiRuleNode: &ApiRuleNode{},
					},
					{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
		},
		{
			desc: "success grafana",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
					{
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
				},
			},
		},
		{
			desc: "success grafana with for and annotations",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						ApiRuleNode: &ApiRuleNode{
							For:         &dur,
							Annotations: map[string]string{"foo": "bar"},
							Labels:      map[string]string{"label1": "val1"},
						},
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
					{
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
				},
			},
		},
		{
			desc: "failure mixed",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
					{
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

			var out PostableRuleGroupConfig
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
		input    PostableRuleGroupConfig
		expected Backend
	}{
		{
			desc: "success lotex",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						ApiRuleNode: &ApiRuleNode{},
					},
					{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
			expected: LoTexRulerBackend,
		},
		{
			desc: "success federated lotex",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						ApiRuleNode: &ApiRuleNode{},
					},
					{
						ApiRuleNode: &ApiRuleNode{},
					},
				},
			},
			expected: LoTexRulerBackend,
		},
		{
			desc: "success grafana",
			input: PostableRuleGroupConfig{
				Name:     "foo",
				Interval: 0,
				Rules: []PostableExtendedRuleNode{
					{
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
					{
						GrafanaManagedAlert: &PostableGrafanaRule{},
					},
				},
			},
			expected: GrafanaBackend,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			bt := tc.input.Type()
			require.Equal(t, tc.expected, bt)
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
