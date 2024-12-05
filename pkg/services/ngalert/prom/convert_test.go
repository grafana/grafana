package prom

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrometheusRulesToGrafana(t *testing.T) {
	converter, err := NewConverter(Config{})
	require.NoError(t, err)

	testCases := []struct {
		name        string
		orgID       int64
		namespace   string
		promGroup   PrometheusRuleGroup
		expectError bool
	}{
		{
			name:      "valid rule group",
			orgID:     1,
			namespace: "some-namespace-uid",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: "10s",
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "cpu_usage > 80",
						For:   "5m",
						Labels: map[string]string{
							"severity": "critical",
						},
						Annotations: map[string]string{
							"summary": "CPU usage is critical",
						},
					},
				},
			},
			expectError: false,
		},
		{
			name:      "rules with keep_firing_for are not supported",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: "1m",
				Rules: []PrometheusRule{
					{
						Alert:         "alert-1",
						Expr:          "up == 0",
						KeepFiringFor: "10m",
					},
				},
			},
			expectError: true,
		},
		{
			name:      "invalid interval duration",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: "invalid_duration",
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
				},
			},
			expectError: true,
		},
		{
			name:      "rule with empty interval",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name: "test-group-1",
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
				},
			},
			expectError: false,
		},
		{
			name:      "recording rule",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name: "test-group-1",
				Rules: []PrometheusRule{
					{
						Record: "some_metric",
						Expr:   "sum(rate(http_requests_total[5m]))",
					},
				},
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			grafanaGroup, err := converter.PrometheusRulesToGrafana(tc.orgID, tc.namespace, tc.promGroup)

			if tc.expectError {
				assert.Error(t, err, tc.name)
				return
			}
			assert.NoError(t, err, tc.name)

			assert.Equal(t, tc.promGroup.Name, grafanaGroup.Title, tc.name)
			expectedInterval, _ := parseDurationOrDefault(tc.promGroup.Interval, defaultInterval)
			assert.Equal(t, int64(expectedInterval.Seconds()), grafanaGroup.Interval, tc.name)

			assert.Equal(t, len(tc.promGroup.Rules), len(grafanaGroup.Rules), tc.name)

			for j, promRule := range tc.promGroup.Rules {
				grafanaRule := grafanaGroup.Rules[j]

				if promRule.Record != "" {
					assert.Equal(t, promRule.Record, grafanaRule.Title)
				} else {
					assert.Equal(t, promRule.Alert, grafanaRule.Title)
				}

				if promRule.For != "" {
					expectedFor, _ := parseDurationOrDefault(promRule.For, 0)
					assert.Equal(t, expectedFor, grafanaRule.For, tc.name)
				}

				expectedLabels := make(map[string]string, len(promRule.Labels)+1)
				for k, v := range promRule.Labels {
					expectedLabels[k] = v
				}
				expectedLabels[models.PrometheusStyleRuleLabel] = "true"

				assert.Equal(t, expectedLabels, grafanaRule.Labels, tc.name)
				assert.Equal(t, promRule.Annotations, grafanaRule.Annotations, tc.name)
				assert.True(t, grafanaRule.Metadata.PrometheusStyleRule, tc.name)
			}
		})
	}
}

func TestPrometheusRulesToGrafanaWithDuplicateRuleNames(t *testing.T) {
	converter, err := NewConverter(Config{})
	require.NoError(t, err)

	promGroup := PrometheusRuleGroup{
		Name:     "test-group-1",
		Interval: "10s",
		Rules: []PrometheusRule{
			{
				Alert: "alert",
				Expr:  "up",
			},
			{
				Alert: "alert",
				Expr:  "up",
			},
			{
				Alert: "another alert",
				Expr:  "up",
			},
			{
				Alert: "alert",
				Expr:  "up",
			},
		},
	}

	group, err := converter.PrometheusRulesToGrafana(1, "namespaceUID", promGroup)
	assert.NoError(t, err)

	assert.Equal(t, "test-group-1", group.Title)
	assert.Len(t, group.Rules, 4)
	assert.Equal(t, "alert", group.Rules[0].Title)
	assert.Equal(t, "alert (2)", group.Rules[1].Title)
	assert.Equal(t, "another alert", group.Rules[2].Title)
	assert.Equal(t, "alert (3)", group.Rules[3].Title)
}

func TestGrafanaRulesToPrometheus(t *testing.T) {
	t.Run("basic alert rule group success", func(t *testing.T) {
		converter, err := NewConverter(Config{})
		require.NoError(t, err)

		rg := models.AlertRuleGroup{
			Title:    "my-group",
			Interval: 60,
			Rules: []models.AlertRule{
				{
					OrgID:        1,
					NamespaceUID: "my-namespace",
					Title:        "my-rule1",
					Data: []models.AlertQuery{
						{
							RefID:         "A",
							QueryType:     "something idk",
							DatasourceUID: "some ds",
							Model: serializeMap(t, map[string]interface{}{
								"datasource": map[string]interface{}{
									"type": "prometheus",
									"uid":  "some ds",
								},
								"editorMode":    "code",
								"expr":          "vector(1)",
								"instant":       true,
								"range":         false,
								"intervalMs":    1000,
								"legendFormat":  "__auto",
								"maxDataPoints": 43200,
								"refId":         "A",
							}),
						},
					},
					Condition:       "A",
					NoDataState:     models.Alerting,
					ExecErrState:    models.AlertingErrState,
					Annotations:     map[string]string{"ann1": "val1"},
					Labels:          map[string]string{"lbl1": "val1"},
					IsPaused:        false,
					For:             time.Duration(5) * time.Minute,
					RuleGroup:       "my-group",
					IntervalSeconds: 60,
				},
			},
		}

		conv, err := converter.GrafanaRulesToPrometheus(&rg)
		assert.NoError(t, err)

		assert.Equal(t, "my-group", conv.Name)
		assert.Equal(t, "1m", conv.Interval)
		assert.Len(t, conv.Rules, 1)
		assert.Equal(t, "my-rule1", conv.Rules[0].Alert)
		assert.Equal(t, "", conv.Rules[0].Record)
		assert.Equal(t, "vector(1)", conv.Rules[0].Expr)
		assert.Equal(t, "5m", conv.Rules[0].For)
		assert.Equal(t, "", conv.Rules[0].KeepFiringFor)
		assert.Equal(t, rg.Rules[0].Labels, conv.Rules[0].Labels)
		assert.Equal(t, rg.Rules[0].Annotations, conv.Rules[0].Annotations)
	})
}

func serializeMap(t *testing.T, m map[string]interface{}) json.RawMessage {
	t.Helper()

	b, err := json.Marshal(m)
	assert.NoError(t, err)
	return json.RawMessage(b)
}
