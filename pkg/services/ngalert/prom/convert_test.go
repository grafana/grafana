package prom

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPrometheusRulesToGrafana(t *testing.T) {
	converter := NewConverter(Config{})

	testCases := []struct {
		name        string
		orgID       int64
		namespace   string
		input       []PrometheusRuleGroup
		expectError bool
	}{
		{
			name:      "valid rule group",
			orgID:     1,
			namespace: "some-namespace-uid",
			input: []PrometheusRuleGroup{
				{
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
			},
			expectError: false,
		},
		{
			name:      "rules with keep_firing_for are not supported",
			orgID:     1,
			namespace: "namespaceUID",
			input: []PrometheusRuleGroup{
				{
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
			},
			expectError: true,
		},
		{
			name:      "invalid interval duration",
			orgID:     1,
			namespace: "namespaceUID",
			input: []PrometheusRuleGroup{
				{
					Name:     "test-group-1",
					Interval: "invalid_duration",
					Rules: []PrometheusRule{
						{
							Alert: "alert-1",
							Expr:  "up == 0",
						},
					},
				},
			},
			expectError: true,
		},
		{
			name:      "rule with empty interval",
			orgID:     1,
			namespace: "namespaceUID",
			input: []PrometheusRuleGroup{
				{
					Name: "test-group-1",
					Rules: []PrometheusRule{
						{
							Alert: "alert-1",
							Expr:  "up == 0",
						},
					},
				},
			},
			expectError: false,
		},
		{
			name:      "recording rule",
			orgID:     1,
			namespace: "namespaceUID",
			input: []PrometheusRuleGroup{
				{
					Name: "test-group-1",
					Rules: []PrometheusRule{
						{
							Record: "some_metric",
							Expr:   "sum(rate(http_requests_total[5m]))",
						},
					},
				},
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			grafanaGroups, err := converter.PrometheusRulesToGrafana(tc.orgID, tc.namespace, tc.input)

			if tc.expectError {
				assert.Error(t, err, tc.name)
				return
			}

			assert.NoError(t, err, tc.name)
			assert.Equal(t, len(tc.input), len(grafanaGroups), tc.name)

			for i, promGroup := range tc.input {
				grafanaGroup := grafanaGroups[i]

				assert.Equal(t, promGroup.Name, grafanaGroup.Title, tc.name)
				expectedInterval, _ := parseDurationOrDefault(promGroup.Interval, defaultInterval)
				assert.Equal(t, int64(expectedInterval.Seconds()), grafanaGroup.Interval, tc.name)

				assert.Equal(t, len(promGroup.Rules), len(grafanaGroup.Rules), tc.name)

				for j, promRule := range promGroup.Rules {
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
					assert.Equal(t, promRule.Labels, grafanaRule.Labels, tc.name)
					assert.Equal(t, promRule.Annotations, grafanaRule.Annotations, tc.name)
				}
			}
		})
	}
}
