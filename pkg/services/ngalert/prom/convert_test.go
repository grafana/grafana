package prom

import (
	"encoding/json"
	"fmt"
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
						KeepFiringFor: util.Pointer(prommodel.Duration(5 * time.Minute)),
					},
				},
			},
			expectError: true,
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
					require.Equal(t, fmt.Sprintf("[%s] %s", tc.promGroup.Name, promRule.Record), grafanaRule.Title)
					require.NotNil(t, grafanaRule.Record)
					require.Equal(t, grafanaRule.Record.From, queryRefID)
					require.Equal(t, promRule.Record, grafanaRule.Record.Metric)
				} else {
					require.Equal(t, fmt.Sprintf("[%s] %s", tc.promGroup.Name, promRule.Alert), grafanaRule.Title)
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

				uidData := fmt.Sprintf("%d|%s|%s|%d", tc.orgID, tc.namespace, tc.promGroup.Name, j)
				u := uuid.NewSHA1(uuid.NameSpaceOID, []byte(uidData))
				require.Equal(t, u.String(), grafanaRule.UID, tc.name)

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
	require.Equal(t, "[test-group-1] alert", group.Rules[0].Title)
	require.Equal(t, "[test-group-1] alert (2)", group.Rules[1].Title)
	require.Equal(t, "[test-group-1] another alert", group.Rules[2].Title)
	require.Equal(t, "[test-group-1] alert (3)", group.Rules[3].Title)
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
