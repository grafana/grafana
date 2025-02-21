package prom

import (
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestPrometheusRulesToGrafana(t *testing.T) {
	fiveMin := prommodel.Duration(5 * time.Minute)

	testCases := []struct {
		name        string
		orgID       int64
		namespace   string
		promGroup   PrometheusRuleGroup
		config      Config
		expectError bool
	}{
		{
			name:      "valid rule group",
			orgID:     1,
			namespace: "some-namespace-uid",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "cpu_usage > 80",
						For:   &fiveMin,
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
				Interval: prommodel.Duration(1 * time.Minute),
				Rules: []PrometheusRule{
					{
						Alert:         "alert-1",
						Expr:          "up == 0",
						KeepFiringFor: &fiveMin,
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
			tc.config.DatasourceUID = "datasource-uid"
			tc.config.DatasourceType = datasources.DS_PROMETHEUS
			converter, err := NewConverter(tc.config)
			require.NoError(t, err)

			grafanaGroup, err := converter.PrometheusRulesToGrafana(tc.orgID, tc.namespace, tc.promGroup)

			if tc.expectError {
				require.Error(t, err, tc.name)
				return
			}
			require.NoError(t, err, tc.name)

			require.Equal(t, tc.promGroup.Name, grafanaGroup.Title, tc.name)
			expectedInterval := int64(time.Duration(tc.promGroup.Interval).Seconds())
			require.Equal(t, expectedInterval, grafanaGroup.Interval, tc.name)

			require.Equal(t, len(tc.promGroup.Rules), len(grafanaGroup.Rules), tc.name)

			for j, promRule := range tc.promGroup.Rules {
				grafanaRule := grafanaGroup.Rules[j]

				if promRule.Record != "" {
					require.Equal(t, promRule.Record, grafanaRule.Title)
				} else {
					require.Equal(t, promRule.Alert, grafanaRule.Title)
				}

				var expectedFor time.Duration
				if promRule.For != nil {
					expectedFor = time.Duration(*promRule.For)
				}
				require.Equal(t, expectedFor, grafanaRule.For, tc.name)

				expectedLabels := make(map[string]string, len(promRule.Labels)+1)
				for k, v := range promRule.Labels {
					expectedLabels[k] = v
				}

				require.Equal(t, expectedLabels, grafanaRule.Labels, tc.name)
				require.Equal(t, promRule.Annotations, grafanaRule.Annotations, tc.name)
				require.Equal(t, models.Duration(0*time.Minute), grafanaRule.Data[0].RelativeTimeRange.To)
				require.Equal(t, models.Duration(10*time.Minute), grafanaRule.Data[0].RelativeTimeRange.From)

				originalRuleDefinition, err := yaml.Marshal(promRule)
				require.NoError(t, err)
				require.Equal(t, string(originalRuleDefinition), grafanaRule.Metadata.PrometheusStyleRule.OriginalRuleDefinition)
			}
		})
	}
}

func TestPrometheusRulesToGrafanaWithDuplicateRuleNames(t *testing.T) {
	cfg := Config{
		DatasourceUID:  "datasource-uid",
		DatasourceType: datasources.DS_PROMETHEUS,
	}
	converter, err := NewConverter(cfg)
	require.NoError(t, err)

	promGroup := PrometheusRuleGroup{
		Name:     "test-group-1",
		Interval: prommodel.Duration(10 * time.Second),
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
	require.NoError(t, err)

	require.Equal(t, "test-group-1", group.Title)
	require.Len(t, group.Rules, 4)
	require.Equal(t, "alert", group.Rules[0].Title)
	require.Equal(t, "alert (2)", group.Rules[1].Title)
	require.Equal(t, "another alert", group.Rules[2].Title)
	require.Equal(t, "alert (3)", group.Rules[3].Title)
}
