package prom

import (
	"encoding/json"
	"fmt"
	"maps"
	"testing"
	"time"

	"github.com/google/uuid"
	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestPrometheusRulesToGrafana(t *testing.T) {
	defaultInterval := 2 * time.Minute

	testCases := []struct {
		name        string
		orgID       int64
		namespace   string
		promGroup   PrometheusRuleGroup
		config      Config
		expectError bool
		errorMsg    string
	}{
		{
			name:      "valid rule group",
			orgID:     1,
			namespace: "some-namespace-uid",
			promGroup: PrometheusRuleGroup{
				Name:        "test-group-1",
				Interval:    prommodel.Duration(10 * time.Second),
				QueryOffset: util.Pointer(prommodel.Duration(1 * time.Minute)),
				Rules: []PrometheusRule{
					{
						Alert:         "alert-1",
						Expr:          "cpu_usage > 80",
						For:           util.Pointer(prommodel.Duration(5 * time.Minute)),
						KeepFiringFor: util.Pointer(prommodel.Duration(60 * time.Second)),
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
			// If the rule group has no recording rules, the target datasource
			// can be anything and should not be validated.
			name:      "alert rules with non-prometheus target datasource",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
				},
			},
			config: Config{
				TargetDatasourceUID:  "target-datasource-uid",
				TargetDatasourceType: "non-prometheus-datasource",
			},
			expectError: false,
		},
		{
			// If the rule group has recording rules and a non-prometheus target datasource,
			// we should return an error
			name:      "recording rules with non-prometheus target datasource",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Record: "some_metric",
						Expr:   "sum(rate(http_requests_total[5m]))",
					},
				},
			},
			config: Config{
				TargetDatasourceUID:  "target-datasource-uid",
				TargetDatasourceType: "non-prometheus-datasource",
			},
			expectError: true,
			errorMsg:    "invalid target datasource type: non-prometheus-datasource, must be prometheus",
		},
		{
			// If the rule group has recording rules and a non-prometheus target datasource,
			// we should return an error
			name:      "mixed group with both alert and recording rules requires prometheus target datasource",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "mixed-rules-group",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
					{
						Record: "some_metric",
						Expr:   "sum(rate(http_requests_total[5m]))",
					},
				},
			},
			config: Config{
				TargetDatasourceUID:  "target-datasource-uid",
				TargetDatasourceType: "non-prometheus-datasource",
			},
			expectError: true,
			errorMsg:    "invalid target datasource type: non-prometheus-datasource, must be prometheus",
		},
		{
			name:      "rule group with empty interval",
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
			name:      "rule group with empty name",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name: "",
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
				},
			},
			expectError: true,
			errorMsg:    "rule group name must not be empty",
		},
		{
			name:      "recording rule",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Record: "some_metric",
						Expr:   "sum(rate(http_requests_total[5m]))",
					},
				},
			},
			expectError: false,
		},
		{
			name:      "recording rule with target datasource",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Record: "some_metric",
						Expr:   "sum(rate(http_requests_total[5m]))",
					},
				},
			},
			config: Config{
				TargetDatasourceUID:  "target-datasource-uid",
				TargetDatasourceType: datasources.DS_PROMETHEUS,
			},
			expectError: false,
		},
		{
			name:      "query_offset must be >= 0",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:        "test-group-1",
				Interval:    prommodel.Duration(10 * time.Second),
				QueryOffset: util.Pointer(prommodel.Duration(-1)),
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
				},
			},
			expectError: true,
			errorMsg:    "query_offset must be >= 0",
		},
		{
			name:      "rule group with limit is not supported",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Limit:    5,
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "up == 0",
					},
				},
			},
			expectError: true,
			errorMsg:    "limit is not supported",
		},
		{
			name:      "rule group with labels",
			orgID:     1,
			namespace: "namespaceUID",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Labels:   map[string]string{"team": "devops"},
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
			name:      "when global query offset is set, it should be used",
			orgID:     1,
			namespace: "some-namespace-uid",
			promGroup: PrometheusRuleGroup{
				Name:     "test-group-1",
				Interval: prommodel.Duration(10 * time.Second),
				Rules: []PrometheusRule{
					{
						Alert: "alert-1",
						Expr:  "cpu_usage > 80",
						For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
						Labels: map[string]string{
							"severity": "critical",
						},
						Annotations: map[string]string{
							"summary": "CPU usage is critical",
						},
					},
				},
			},
			config: Config{
				EvaluationOffset: util.Pointer(5 * time.Minute),
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.config.DatasourceUID = "datasource-uid"
			tc.config.DatasourceType = datasources.DS_PROMETHEUS
			tc.config.DefaultInterval = defaultInterval
			converter, err := NewConverter(tc.config)
			require.NoError(t, err)

			grafanaGroup, err := converter.PrometheusRulesToGrafana(tc.orgID, tc.namespace, tc.promGroup)

			if tc.expectError {
				require.Error(t, err, tc.name)
				if tc.errorMsg != "" {
					require.Contains(t, err.Error(), tc.errorMsg, tc.name)
				}
				return
			}
			require.NoError(t, err, tc.name)

			require.Equal(t, tc.promGroup.Name, grafanaGroup.Title, tc.name)

			expectedInterval := int64(time.Duration(tc.promGroup.Interval).Seconds())
			if expectedInterval == 0 {
				expectedInterval = int64(defaultInterval.Seconds())
			}
			require.Equal(t, expectedInterval, grafanaGroup.Interval, tc.name)

			require.Equal(t, len(tc.promGroup.Rules), len(grafanaGroup.Rules), tc.name)

			for j, promRule := range tc.promGroup.Rules {
				grafanaRule := grafanaGroup.Rules[j]

				if promRule.Record != "" {
					require.Equal(t, promRule.Record, grafanaRule.Title)
					require.NotNil(t, grafanaRule.Record)
					require.Equal(t, grafanaRule.Record.From, queryRefID)
					require.Equal(t, promRule.Record, grafanaRule.Record.Metric)

					targetDatasourceUID := tc.config.TargetDatasourceUID
					if targetDatasourceUID == "" {
						targetDatasourceUID = tc.config.DatasourceUID
					}
					require.Equal(t, targetDatasourceUID, grafanaRule.Record.TargetDatasourceUID)
				} else {
					require.Equal(t, promRule.Alert, grafanaRule.Title)
				}

				var expectedFor time.Duration
				if promRule.For != nil {
					expectedFor = time.Duration(*promRule.For)
				}
				require.Equal(t, expectedFor, grafanaRule.For, tc.name)

				var expectedKeepFiringFor time.Duration
				if promRule.KeepFiringFor != nil {
					expectedKeepFiringFor = time.Duration(*promRule.KeepFiringFor)
				}
				require.Equal(t, expectedKeepFiringFor, grafanaRule.KeepFiringFor, tc.name)

				expectedLabels := make(map[string]string, len(promRule.Labels)+len(tc.promGroup.Labels))
				maps.Copy(expectedLabels, tc.promGroup.Labels)
				maps.Copy(expectedLabels, promRule.Labels)
				expectedLabels = withInternalLabel(expectedLabels)

				uidData := fmt.Sprintf("%d|%s|%s|%d", tc.orgID, tc.namespace, tc.promGroup.Name, j)
				u := uuid.NewSHA1(uuid.NameSpaceOID, []byte(uidData))
				require.Equal(t, u.String(), grafanaRule.UID, tc.name)

				require.Equal(t, expectedLabels, grafanaRule.Labels, tc.name)
				require.Equal(t, promRule.Annotations, grafanaRule.Annotations, tc.name)

				evalOffset := time.Duration(0)
				if tc.config.EvaluationOffset != nil {
					evalOffset = *tc.config.EvaluationOffset
				}
				if tc.promGroup.QueryOffset != nil {
					// group-level offset takes precedence
					evalOffset = time.Duration(*tc.promGroup.QueryOffset)
				}

				require.Equal(t, models.Duration(evalOffset), grafanaRule.Data[0].RelativeTimeRange.To)
				require.Equal(t, models.Duration(10*time.Minute+evalOffset), grafanaRule.Data[0].RelativeTimeRange.From)
				require.Equal(t, util.Pointer(1), grafanaRule.MissingSeriesEvalsToResolve)

				require.Equal(t, models.OkErrState, grafanaRule.ExecErrState)
				require.Equal(t, models.OK, grafanaRule.NoDataState)

				// Update the rule with the group-level labels,
				// to test that they are saved to the rule definition.
				mergedLabels := make(map[string]string)
				maps.Copy(mergedLabels, tc.promGroup.Labels)
				maps.Copy(mergedLabels, promRule.Labels)
				promRule.Labels = mergedLabels
				originalRuleDefinition, err := yaml.Marshal(promRule)
				require.NoError(t, err)
				require.Equal(t, string(originalRuleDefinition), grafanaRule.Metadata.PrometheusStyleRule.OriginalRuleDefinition)
			}
		})
	}
}

func TestPrometheusRulesToGrafanaWithDuplicateRuleNames(t *testing.T) {
	cfg := Config{
		DatasourceUID:   "datasource-uid",
		DatasourceType:  datasources.DS_PROMETHEUS,
		DefaultInterval: 2 * time.Minute,
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
	require.Equal(t, "alert", group.Rules[1].Title)
	require.Equal(t, "another alert", group.Rules[2].Title)
	require.Equal(t, "alert", group.Rules[3].Title)
}

func TestCreateMathNode(t *testing.T) {
	node, err := createMathNode()
	require.NoError(t, err)

	require.Equal(t, expr.DatasourceUID, node.DatasourceUID)
	require.Equal(t, string(expr.QueryTypeMath), node.QueryType)
	require.Equal(t, "prometheus_math", node.RefID)

	var model map[string]interface{}
	err = json.Unmarshal(node.Model, &model)
	require.NoError(t, err)

	require.Equal(t, "prometheus_math", model["refId"])
	require.Equal(t, string(expr.QueryTypeMath), model["type"])
	require.Equal(t, "is_number($query) || is_nan($query) || is_inf($query)", model["expression"])

	ds := model["datasource"].(map[string]interface{})
	require.Equal(t, expr.DatasourceUID, ds["name"])
	require.Equal(t, expr.DatasourceType, ds["type"])
	require.Equal(t, expr.DatasourceUID, ds["uid"])
}

func TestCreateThresholdNode(t *testing.T) {
	node, err := createThresholdNode()
	require.NoError(t, err)

	require.Equal(t, expr.DatasourceUID, node.DatasourceUID)
	require.Equal(t, string(expr.QueryTypeThreshold), node.QueryType)
	require.Equal(t, "threshold", node.RefID)

	var model map[string]interface{}
	err = json.Unmarshal(node.Model, &model)
	require.NoError(t, err)

	require.Equal(t, "threshold", model["refId"])
	require.Equal(t, string(expr.QueryTypeThreshold), model["type"])

	ds := model["datasource"].(map[string]interface{})
	require.Equal(t, expr.DatasourceUID, ds["name"])
	require.Equal(t, expr.DatasourceType, ds["type"])
	require.Equal(t, expr.DatasourceUID, ds["uid"])

	conditions := model["conditions"].([]interface{})
	require.Len(t, conditions, 1)

	condition := conditions[0].(map[string]interface{})
	evaluator := condition["evaluator"].(map[string]interface{})
	require.Equal(t, string(expr.ThresholdIsAbove), evaluator["type"])
	require.Equal(t, []interface{}{float64(0)}, evaluator["params"])
}

func TestPrometheusRulesToGrafana_NodesInRules(t *testing.T) {
	cfg := Config{
		DatasourceUID:   "datasource-uid",
		DatasourceType:  datasources.DS_PROMETHEUS,
		DefaultInterval: 2 * time.Minute,
	}
	converter, err := NewConverter(cfg)
	require.NoError(t, err)

	t.Run("alert rule should have math and threshold nodes", func(t *testing.T) {
		group := PrometheusRuleGroup{
			Name: "test",
			Rules: []PrometheusRule{
				{
					Alert: "alert1",
					Expr:  "up == 0",
				},
			},
		}

		result, err := converter.PrometheusRulesToGrafana(1, "namespace", group)
		require.NoError(t, err)
		require.Len(t, result.Rules, 1)
		require.Len(t, result.Rules[0].Data, 3)

		// First node should be query
		require.Equal(t, "query", result.Rules[0].Data[0].RefID)

		// Second node should be math
		require.Equal(t, "prometheus_math", result.Rules[0].Data[1].RefID)
		require.Equal(t, string(expr.QueryTypeMath), result.Rules[0].Data[1].QueryType)
		// Check that the math expression is valid
		var model map[string]interface{}
		err = json.Unmarshal(result.Rules[0].Data[1].Model, &model)
		require.NoError(t, err)
		require.Equal(t, "is_number($query) || is_nan($query) || is_inf($query)", model["expression"])
		// The math expression should be parsed successfully
		_, err = mathexp.New(model["expression"].(string))
		require.NoError(t, err)

		// Third node should be threshold
		require.Equal(t, "threshold", result.Rules[0].Data[2].RefID)
		require.Equal(t, string(expr.QueryTypeThreshold), result.Rules[0].Data[2].QueryType)
	})

	t.Run("recording rule should only have query node", func(t *testing.T) {
		group := PrometheusRuleGroup{
			Name: "test",
			Rules: []PrometheusRule{
				{
					Record: "metric",
					Expr:   "sum(rate(http_requests_total[5m]))",
				},
			},
		}

		result, err := converter.PrometheusRulesToGrafana(1, "namespace", group)
		require.NoError(t, err)
		require.Len(t, result.Rules, 1)
		require.Len(t, result.Rules[0].Data, 1)

		// Should only have query node
		require.Equal(t, "query", result.Rules[0].Data[0].RefID)
	})
}

func TestPrometheusRulesToGrafana_GroupLabels(t *testing.T) {
	cfg := Config{
		DatasourceUID:   "datasource-uid",
		DatasourceType:  datasources.DS_PROMETHEUS,
		DefaultInterval: 2 * time.Minute,
	}
	converter, err := NewConverter(cfg)
	require.NoError(t, err)

	t.Run("group labels are merged with alert rule labels", func(t *testing.T) {
		promGroup := PrometheusRuleGroup{
			Name:     "test-group-1",
			Interval: prommodel.Duration(10 * time.Second),
			Labels: map[string]string{
				"group_label":  "group_value",
				"common_label": "group_value",
			},
			Rules: []PrometheusRule{
				{
					Alert: "alert-1",
					Expr:  "cpu_usage > 80",
					Labels: map[string]string{
						"rule_label":   "rule_value",
						"common_label": "rule_value", // rule-level label should take precedence
					},
				},
			},
		}

		grafanaGroup, err := converter.PrometheusRulesToGrafana(1, "namespace", promGroup)
		require.NoError(t, err)
		require.Len(t, grafanaGroup.Rules, 1)

		// Check that the labels are merged and the rule label takes precedence
		require.Equal(
			t,
			withInternalLabel(map[string]string{
				"group_label":  "group_value",
				"rule_label":   "rule_value",
				"common_label": "rule_value",
			}),
			grafanaGroup.Rules[0].Labels,
		)
	})

	t.Run("group labels are merged with recording rule labels", func(t *testing.T) {
		promGroup := PrometheusRuleGroup{
			Name:     "recording-group",
			Interval: prommodel.Duration(10 * time.Second),
			Labels: map[string]string{
				"group_label":  "group_value",
				"common_label": "group_value",
			},
			Rules: []PrometheusRule{
				{
					Record: "recording_metric",
					Expr:   "sum(rate(http_requests_total[5m]))",
					Labels: map[string]string{
						"rule_label":   "rule_value",
						"common_label": "rule_value",
					},
				},
			},
		}

		grafanaGroup, err := converter.PrometheusRulesToGrafana(1, "namespace", promGroup)
		require.NoError(t, err)
		require.Len(t, grafanaGroup.Rules, 1)

		// Check that the labels are merged and the rule label takes precedence
		require.Equal(
			t,
			withInternalLabel(map[string]string{
				"group_label":  "group_value",
				"rule_label":   "rule_value",
				"common_label": "rule_value",
			}),
			grafanaGroup.Rules[0].Labels,
		)
	})

	t.Run("rule with no labels gets group labels", func(t *testing.T) {
		promGroup := PrometheusRuleGroup{
			Name:     "group-with-labels",
			Interval: prommodel.Duration(10 * time.Second),
			Labels: map[string]string{
				"group_label1": "group_value1",
				"group_label2": "group_value2",
			},
			Rules: []PrometheusRule{
				{
					Alert: "alert-no-labels",
					Expr:  "up == 0",
				},
			},
		}

		grafanaGroup, err := converter.PrometheusRulesToGrafana(1, "namespace", promGroup)
		require.NoError(t, err)
		require.Len(t, grafanaGroup.Rules, 1)
		require.Equal(t, withInternalLabel(promGroup.Labels), grafanaGroup.Rules[0].Labels)
	})

	t.Run("rule and group with nil labels", func(t *testing.T) {
		promGroup := PrometheusRuleGroup{
			Name:     "group-no-labels",
			Interval: prommodel.Duration(10 * time.Second),
			Rules: []PrometheusRule{
				{
					Alert: "alert-no-labels",
					Expr:  "up == 0",
				},
			},
		}

		grafanaGroup, err := converter.PrometheusRulesToGrafana(1, "namespace", promGroup)
		require.NoError(t, err)
		require.Len(t, grafanaGroup.Rules, 1)
		require.Equal(t, withInternalLabel(map[string]string{}), grafanaGroup.Rules[0].Labels)
	})
}

func TestPrometheusRulesToGrafana_UID(t *testing.T) {
	orgID := int64(1)
	namespace := "some-namespace"

	promGroup := PrometheusRuleGroup{
		Name:     "test-group-1",
		Interval: prommodel.Duration(10 * time.Second),
		Rules: []PrometheusRule{
			{
				Alert: "alert-1",
				Expr:  "cpu_usage > 80",
				For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
				Labels: map[string]string{
					"severity":   "critical",
					ruleUIDLabel: "rule-uid-1",
				},
				Annotations: map[string]string{
					"summary": "CPU usage is critical",
				},
			},
		},
	}

	converter, err := NewConverter(Config{
		DatasourceUID:   "datasource-uid",
		DatasourceType:  datasources.DS_PROMETHEUS,
		DefaultInterval: 2 * time.Minute,
	})
	require.NoError(t, err)

	t.Run("if not specified, UID is generated based on the rule index", func(t *testing.T) {
		grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
		require.NoError(t, err)

		firstUID := grafanaGroup.Rules[0].UID

		// Convert again
		grafanaGroup, err = converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
		require.NoError(t, err)

		secondUID := grafanaGroup.Rules[0].UID

		// They must be equal
		require.NotEmpty(t, firstUID)
		require.Equal(t, firstUID, secondUID)
	})

	t.Run("if the special label is specified", func(t *testing.T) {
		t.Run("and the label is valid it should be used", func(t *testing.T) {
			orgID := int64(1)
			namespace := "some-namespace"

			converter, err := NewConverter(Config{
				DatasourceUID:   "datasource-uid",
				DatasourceType:  datasources.DS_PROMETHEUS,
				DefaultInterval: 2 * time.Minute,
			})
			require.NoError(t, err)

			promGroup.Rules[0].Labels[ruleUIDLabel] = "rule-uid-1"

			grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
			require.NoError(t, err)

			require.Equal(t, "rule-uid-1", grafanaGroup.Rules[0].UID)
		})

		t.Run("and the label is invalid", func(t *testing.T) {
			orgID := int64(1)
			namespace := "some-namespace"

			converter, err := NewConverter(Config{
				DatasourceUID:   "datasource-uid",
				DatasourceType:  datasources.DS_PROMETHEUS,
				DefaultInterval: 2 * time.Minute,
			})
			require.NoError(t, err)

			// create a string of 50 characters
			promGroup.Rules[0].Labels[ruleUIDLabel] = "aaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkkkllllmm" // too long

			grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
			require.Errorf(t, err, "invalid UID label value")
			require.Nil(t, grafanaGroup)
		})

		t.Run("and the label is empty", func(t *testing.T) {
			orgID := int64(1)
			namespace := "some-namespace"

			converter, err := NewConverter(Config{
				DatasourceUID:   "datasource-uid",
				DatasourceType:  datasources.DS_PROMETHEUS,
				DefaultInterval: 2 * time.Minute,
			})
			require.NoError(t, err)

			promGroup.Rules[0].Labels[ruleUIDLabel] = ""

			grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
			require.Errorf(t, err, "invalid UID label value")
			require.Nil(t, grafanaGroup)
		})
	})
}

func TestPrometheusRulesToGrafana_KeepOriginalRuleDefinition(t *testing.T) {
	orgID := int64(1)
	namespace := "namespace"

	promGroup := PrometheusRuleGroup{
		Name: "test-group",
		Rules: []PrometheusRule{
			{
				Alert: "test-alert",
				Expr:  "up == 0",
			},
		},
	}

	testCases := []struct {
		name                       string
		keepOriginalRuleDefinition *bool
		expectDefinition           bool
	}{
		{
			name:                       "keep original rule definition is true",
			keepOriginalRuleDefinition: util.Pointer(true),
			expectDefinition:           true,
		},
		{
			name:                       "keep original rule definition is false",
			keepOriginalRuleDefinition: util.Pointer(false),
			expectDefinition:           false,
		},
		{
			name:                       "keep original rule definition is nil (should use default)",
			keepOriginalRuleDefinition: nil,
			expectDefinition:           true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := Config{
				DatasourceUID:              "datasource-uid",
				DatasourceType:             datasources.DS_PROMETHEUS,
				DefaultInterval:            1 * time.Minute,
				KeepOriginalRuleDefinition: tc.keepOriginalRuleDefinition,
			}

			converter, err := NewConverter(cfg)
			require.NoError(t, err)

			// Convert the Prometheus rule to Grafana
			grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
			require.NoError(t, err)
			require.Len(t, grafanaGroup.Rules, 1)

			if tc.expectDefinition {
				originalRuleDefinition, err := yaml.Marshal(promGroup.Rules[0])
				require.NoError(t, err)
				require.Equal(
					t,
					string(originalRuleDefinition),
					grafanaGroup.Rules[0].Metadata.PrometheusStyleRule.OriginalRuleDefinition,
				)
			} else {
				require.Nil(t, grafanaGroup.Rules[0].Metadata.PrometheusStyleRule)
			}
		})
	}
}

func TestPrometheusRulesToGrafana_NotificationSettings(t *testing.T) {
	orgID := int64(1)
	namespace := "namespace"

	promGroup := PrometheusRuleGroup{
		Name: "test-group",
		Rules: []PrometheusRule{
			{
				Alert: "test-alert",
				Expr:  "up == 0",
			},
		},
	}

	testCases := []struct {
		name                 string
		notificationSettings []models.NotificationSettings
	}{
		{
			name: "with notification settings specified",
			notificationSettings: []models.NotificationSettings{
				{
					Receiver: "test-receiver",
					GroupBy:  []string{"alertname", "instance"},
				},
			},
		},
		{
			name:                 "without notification settings",
			notificationSettings: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := Config{
				DatasourceUID:        "datasource-uid",
				DatasourceType:       datasources.DS_PROMETHEUS,
				DefaultInterval:      1 * time.Minute,
				NotificationSettings: tc.notificationSettings,
			}

			converter, err := NewConverter(cfg)
			require.NoError(t, err)

			grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespace, promGroup)
			require.NoError(t, err)
			require.Len(t, grafanaGroup.Rules, 1)

			if tc.notificationSettings != nil {
				require.NotNil(t, grafanaGroup.Rules[0].NotificationSettings)
				require.Len(t, grafanaGroup.Rules[0].NotificationSettings, len(tc.notificationSettings))
				require.Equal(t, tc.notificationSettings, grafanaGroup.Rules[0].NotificationSettings)
			} else {
				require.Nil(t, grafanaGroup.Rules[0].NotificationSettings)
			}
		})
	}
}

func TestQueryModelContainsRequiredParameters(t *testing.T) {
	cfg := Config{
		DatasourceUID:   "datasource-uid",
		DatasourceType:  datasources.DS_PROMETHEUS,
		DefaultInterval: 1 * time.Minute,
	}
	converter, err := NewConverter(cfg)
	require.NoError(t, err)

	promRule := PrometheusRule{
		Alert: "test-alert",
		Expr:  "up == 0",
	}

	queries, err := converter.createQuery(promRule.Expr, false, PrometheusRuleGroup{})
	require.NoError(t, err)
	require.Len(t, queries, 3)

	for _, query := range queries {
		var model map[string]any
		err = json.Unmarshal(query.Model, &model)
		require.NoError(t, err)

		// Check intervalMs
		intervalMs, exists := model["intervalMs"]
		require.True(t, exists)
		_, isNumber := intervalMs.(float64)
		require.True(t, isNumber, "intervalMs should be a number")

		// Check maxDataPoints
		maxDataPoints, exists := model["maxDataPoints"]
		require.True(t, exists)
		_, isNumber = maxDataPoints.(float64)
		require.True(t, isNumber, "maxDataPoints should be a number")
	}
}

func withInternalLabel(l map[string]string) map[string]string {
	result := map[string]string{
		models.ConvertedPrometheusRuleLabel: "true",
	}
	maps.Copy(result, l)

	return result
}
