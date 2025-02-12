package prom

import (
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestPrometheusRulesFileYAML(t *testing.T) {
	interval := prommodel.Duration(5 * time.Minute)
	alertFor := prommodel.Duration(10 * time.Minute)
	keepFiring := prommodel.Duration(15 * time.Minute)

	tests := []struct {
		name         string
		input        PrometheusRulesFile
		expectedYAML string
	}{
		{
			name: "simple alert rule and a recording rule",
			input: PrometheusRulesFile{
				Groups: []PrometheusRuleGroup{
					{
						Name:     "test_group",
						Interval: interval,
						Rules: []PrometheusRule{
							{
								Alert:         "alert-1",
								Expr:          "vector(0) > 90",
								For:           &alertFor,
								KeepFiringFor: &keepFiring,
								Labels: map[string]string{
									"team": "alerting",
								},
								Annotations: map[string]string{
									"summary":     "some summary",
									"description": "some description",
								},
							},
							{
								Record: "vector(1)",
							},
						},
					},
				},
			},
			expectedYAML: `
groups:
    - name: test_group
      interval: 5m
      rules:
        - alert: alert-1
          expr: vector(0) > 90
          for: 10m
          keep_firing_for: 15m
          labels:
            team: alerting
          annotations:
            description: some description
            summary: some summary
        - record: vector(1)
`,
		},
		{
			name: "empty rules file",
			input: PrometheusRulesFile{
				Groups: []PrometheusRuleGroup{},
			},
			expectedYAML: `groups: []`,
		},
		{
			name: "empty group",
			input: PrometheusRulesFile{
				Groups: []PrometheusRuleGroup{
					{
						Name:     "empty_group",
						Interval: interval,
						Rules:    []PrometheusRule{},
					},
				},
			},
			expectedYAML: `
groups:
  - name: empty_group
    interval: 5m
    rules: []`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			yamlData, err := yaml.Marshal(tt.input)
			require.NoError(t, err, "Failed to marshal to YAML")
			require.YAMLEq(t, tt.expectedYAML, string(yamlData))

			var parsed PrometheusRulesFile
			err = yaml.Unmarshal(yamlData, &parsed)
			require.NoError(t, err, "Failed to unmarshal from YAML")

			require.Equal(t, tt.input, parsed)
		})
	}
}
