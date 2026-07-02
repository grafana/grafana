package prom

import (
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func newTestConverter(t *testing.T, cfg K8sConverterConfig) *K8sConverter {
	t.Helper()
	c, err := NewK8sConverter(cfg)
	require.NoError(t, err)
	return c
}

func TestK8sConverterConfig_Defaults(t *testing.T) {
	cfg := K8sConverterConfig{DatasourceUID: "ds-123"}.withDefaults()
	assert.Equal(t, datasources.DS_PROMETHEUS, cfg.DatasourceType)
	assert.Equal(t, "ds-123", cfg.TargetDatasourceUID, "TargetDatasourceUID should default to DatasourceUID")
	assert.Equal(t, time.Minute, cfg.DefaultInterval)
	assert.Equal(t, DefaultFromTimeRange, cfg.FromTimeRange)
	assert.Equal(t, alertingv0.AlertRuleNoDataStateOk, cfg.NoDataState)
	assert.Equal(t, alertingv0.AlertRuleExecErrStateOk, cfg.ExecErrState)
}

func TestNewK8sConverter_RejectsInvalidDatasourceType(t *testing.T) {
	_, err := NewK8sConverter(K8sConverterConfig{
		DatasourceUID:  "ds-prom",
		DatasourceType: "mysql",
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrInvalidDatasourceType)
}

func TestNewK8sConverter_AcceptsLoki(t *testing.T) {
	_, err := NewK8sConverter(K8sConverterConfig{
		DatasourceUID:  "ds-loki",
		DatasourceType: datasources.DS_LOKI,
	})
	require.NoError(t, err)
}

func TestK8sBuildAlertRuleSpec_ThreeNodeQueryGraph(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom", DatasourceType: datasources.DS_PROMETHEUS})
	forD := prommodel.Duration(5 * time.Minute)
	group := PrometheusRuleGroup{Name: "group-1"}
	rule := PrometheusRule{
		Alert:       "HighRequestRate",
		Expr:        `sum(rate(http_requests_total[5m])) > 100`,
		For:         &forD,
		Labels:      map[string]string{"severity": "page"},
		Annotations: map[string]string{"summary": "request rate too high"},
	}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)

	assert.Equal(t, "HighRequestRate", spec.Title)
	assert.Equal(t, alertingv0.AlertRulePromDuration("1m"), spec.Trigger.Interval, "default group interval rendered prom-style")
	require.NotNil(t, spec.For)
	assert.Equal(t, "5m0s", *spec.For, "For uses Go time.Duration.String() to match compat-layer output")

	// Three nodes: query / prometheus_math / threshold.
	require.Len(t, spec.Expressions, 3)
	queryNode := spec.Expressions[queryRefID]
	require.NotNil(t, queryNode.DatasourceUID)
	assert.Equal(t, "ds-prom", string(*queryNode.DatasourceUID))
	require.NotNil(t, queryNode.QueryType)
	assert.Equal(t, datasources.DS_PROMETHEUS, *queryNode.QueryType)
	require.NotNil(t, queryNode.RelativeTimeRange)
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("10m0s"), queryNode.RelativeTimeRange.From, "default FromTimeRange=600s + offset=0")
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("0s"), queryNode.RelativeTimeRange.To)
	assert.Nil(t, queryNode.Source)

	mathNode := spec.Expressions[prometheusMathRefID]
	assert.Nil(t, mathNode.DatasourceUID, "math node runs on the expr engine; DatasourceUID must be nil")
	require.NotNil(t, mathNode.QueryType)
	assert.Equal(t, "math", *mathNode.QueryType)
	assert.Nil(t, mathNode.Source)
	mathModel, ok := mathNode.Model.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "is_number($query) || is_nan($query) || is_inf($query)", mathModel["expression"])

	thresholdNode := spec.Expressions[thresholdRefID]
	assert.Nil(t, thresholdNode.DatasourceUID)
	require.NotNil(t, thresholdNode.QueryType)
	assert.Equal(t, "threshold", *thresholdNode.QueryType)
	require.NotNil(t, thresholdNode.Source)
	assert.True(t, *thresholdNode.Source, "threshold must be the rule's source")
}

func TestK8sBuildAlertRuleSpec_GroupQueryOffsetOverridesGlobal(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{
		DatasourceUID:    "ds-prom",
		EvaluationOffset: 30 * time.Second,
	})
	off := prommodel.Duration(2 * time.Minute)
	group := PrometheusRuleGroup{Name: "g", QueryOffset: &off}
	rule := PrometheusRule{Alert: "X", Expr: "up"}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)
	queryNode := spec.Expressions[queryRefID]
	require.NotNil(t, queryNode.RelativeTimeRange)
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("12m0s"), queryNode.RelativeTimeRange.From, "from = FromTimeRange + group queryOffset (10m + 2m)")
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("2m0s"), queryNode.RelativeTimeRange.To, "to = group queryOffset, overriding the global EvaluationOffset")
}

func TestK8sBuildRecordingRuleSpec_SingleQueryNodeIsSource(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom", TargetDatasourceUID: "ds-target"})
	group := PrometheusRuleGroup{Name: "g"}
	rule := PrometheusRule{
		Record: "http_request_rate:sum",
		Expr:   `sum(rate(http_requests_total[1m]))`,
		Labels: map[string]string{"team": "core"},
	}

	spec, err := c.BuildRecordingRuleSpec(group, rule)
	require.NoError(t, err)

	assert.Equal(t, "http_request_rate:sum", spec.Title)
	assert.Equal(t, alertingv0.RecordingRuleMetricName("http_request_rate:sum"), spec.Metric)
	assert.Equal(t, alertingv0.RecordingRuleDatasourceUID("ds-target"), spec.TargetDatasourceUID)

	require.Len(t, spec.Expressions, 1, "recording rules have a single query node")
	node := spec.Expressions[queryRefID]
	require.NotNil(t, node.Source)
	assert.True(t, *node.Source)
	require.NotNil(t, node.DatasourceUID)
	assert.Equal(t, "ds-prom", string(*node.DatasourceUID))
}

func TestK8sBuildAlertRuleSpec_GroupLabelsMergeWithRuleLabels(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom"})
	group := PrometheusRuleGroup{
		Name:   "g",
		Labels: map[string]string{"severity": "warning", "team": "core"},
	}
	rule := PrometheusRule{
		Alert:  "X",
		Expr:   "up == 0",
		Labels: map[string]string{"severity": "critical"},
	}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)
	assert.Equal(t, alertingv0.AlertRuleTemplateString("critical"), spec.Labels["severity"])
	assert.Equal(t, alertingv0.AlertRuleTemplateString("core"), spec.Labels["team"])
}

func TestK8sBuildAlertRuleSpec_ExtraLabelsLowestPrecedence(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{
		DatasourceUID: "ds-prom",
		ExtraLabels:   map[string]string{"env": "prod", "severity": "info"},
	})
	group := PrometheusRuleGroup{
		Name:   "g",
		Labels: map[string]string{"severity": "warning"},
	}
	rule := PrometheusRule{
		Alert: "X",
		Expr:  "up == 0",
	}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)
	// Extra labels provide "env", group label overrides "severity".
	assert.Equal(t, alertingv0.AlertRuleTemplateString("prod"), spec.Labels["env"])
	assert.Equal(t, alertingv0.AlertRuleTemplateString("warning"), spec.Labels["severity"])
}

func TestK8sBuildAlertRuleSpec_PausedWhenConfigured(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom", PauseAlertRules: true})
	spec, err := c.BuildAlertRuleSpec(
		PrometheusRuleGroup{Name: "g"},
		PrometheusRule{Alert: "X", Expr: "up"},
	)
	require.NoError(t, err)
	require.NotNil(t, spec.Paused)
	assert.True(t, *spec.Paused)
}

func TestK8sBuildRecordingRuleSpec_PausedWhenConfigured(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom", PauseRecordingRules: true})
	spec, err := c.BuildRecordingRuleSpec(
		PrometheusRuleGroup{Name: "g"},
		PrometheusRule{Record: "x:sum", Expr: "sum(x)"},
	)
	require.NoError(t, err)
	require.NotNil(t, spec.Paused)
	assert.True(t, *spec.Paused)
}

func TestK8sBuildAlertRuleSpec_RejectsRecordingEntry(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom"})
	_, err := c.BuildAlertRuleSpec(
		PrometheusRuleGroup{Name: "g"},
		PrometheusRule{Record: "x", Expr: "x"},
	)
	assert.Error(t, err)
}

func TestK8sBuildRecordingRuleSpec_RejectsAlertingEntry(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom"})
	_, err := c.BuildRecordingRuleSpec(
		PrometheusRuleGroup{Name: "g"},
		PrometheusRule{Alert: "x", Expr: "x"},
	)
	assert.Error(t, err)
}

func TestK8sBuildAlertRuleSpec_LokiDatasourceQueryTypeInModel(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-loki", DatasourceType: datasources.DS_LOKI})
	spec, err := c.BuildAlertRuleSpec(
		PrometheusRuleGroup{Name: "g"},
		PrometheusRule{Alert: "X", Expr: `{job="x"} |= "err"`},
	)
	require.NoError(t, err)

	queryNode := spec.Expressions[queryRefID]
	require.NotNil(t, queryNode.QueryType)
	assert.Equal(t, datasources.DS_LOKI, *queryNode.QueryType)
	m, ok := queryNode.Model.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "instant", m["queryType"], "Loki query nodes carry an `instant` queryType inside the model JSON")
}

func TestK8sBuildRuleSequenceSpec(t *testing.T) {
	interval := prommodel.Duration(30 * time.Second)
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom"})
	group := PrometheusRuleGroup{Name: "g", Interval: interval}

	spec := c.BuildRuleSequenceSpec(group, []string{"rec-rule-1", "rec-rule-2"}, []string{"alert-rule-1"})

	assert.Equal(t, alertingv0.RuleSequencePromDuration("30s"), spec.Trigger.Interval)
	require.Len(t, spec.RecordingRules, 2)
	assert.Equal(t, alertingv0.RuleSequenceRuleUID("rec-rule-1"), spec.RecordingRules[0].Name)
	assert.Equal(t, alertingv0.RuleSequenceRuleUID("rec-rule-2"), spec.RecordingRules[1].Name)
	require.Len(t, spec.AlertingRules, 1)
	assert.Equal(t, alertingv0.RuleSequenceRuleUID("alert-rule-1"), spec.AlertingRules[0].Name)
}

func TestK8sBuildRuleSequenceSpec_NoAlertingRules(t *testing.T) {
	c := newTestConverter(t, K8sConverterConfig{DatasourceUID: "ds-prom"})
	group := PrometheusRuleGroup{Name: "g"}

	spec := c.BuildRuleSequenceSpec(group, []string{"rec-rule-1"}, nil)

	require.Len(t, spec.RecordingRules, 1)
	assert.Empty(t, spec.AlertingRules)
}

func TestRuleName_StableAcrossInvocations(t *testing.T) {
	rule := PrometheusRule{Alert: "X", Expr: "up"}
	name1, err1 := RuleName("default", "folder-1", "mygroup", 0, rule)
	require.NoError(t, err1)
	name2, err2 := RuleName("default", "folder-1", "mygroup", 0, rule)
	require.NoError(t, err2)
	assert.Equal(t, name1, name2, "same inputs must produce the same name")
}

func TestRuleName_DifferentPositionsProduceDifferentNames(t *testing.T) {
	rule := PrometheusRule{Alert: "X", Expr: "up"}
	name0, _ := RuleName("default", "folder-1", "mygroup", 0, rule)
	name1, _ := RuleName("default", "folder-1", "mygroup", 1, rule)
	assert.NotEqual(t, name0, name1)
}

func TestRuleName_DifferentGroupsProduceDifferentNames(t *testing.T) {
	rule := PrometheusRule{Alert: "X", Expr: "up"}
	nameA, _ := RuleName("default", "folder-1", "group-a", 0, rule)
	nameB, _ := RuleName("default", "folder-1", "group-b", 0, rule)
	assert.NotEqual(t, nameA, nameB)
}

func TestRuleName_DifferentFoldersProduceDifferentNames(t *testing.T) {
	rule := PrometheusRule{Alert: "X", Expr: "up"}
	nameA, _ := RuleName("default", "folder-a", "mygroup", 0, rule)
	nameB, _ := RuleName("default", "folder-b", "mygroup", 0, rule)
	assert.NotEqual(t, nameA, nameB, "same group name in different folders must produce different names")
}

func TestRuleName_HonorsUIDLabel(t *testing.T) {
	rule := PrometheusRule{
		Alert:  "X",
		Expr:   "up",
		Labels: map[string]string{"__grafana_alert_rule_uid__": "custom-uid-123"},
	}
	name, err := RuleName("default", "folder-1", "mygroup", 0, rule)
	require.NoError(t, err)
	assert.Equal(t, "custom-uid-123", name)
}

func TestRuleName_RejectsInvalidUIDLabel(t *testing.T) {
	rule := PrometheusRule{
		Alert:  "X",
		Expr:   "up",
		Labels: map[string]string{"__grafana_alert_rule_uid__": ""},
	}
	// Empty UID label is ignored (falls through to generated UUID).
	name, err := RuleName("default", "folder-1", "mygroup", 0, rule)
	require.NoError(t, err)
	assert.NotEmpty(t, name)

	// Too-long UID label should be rejected.
	rule.Labels["__grafana_alert_rule_uid__"] = "aaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkkkllllmm"
	_, err = RuleName("default", "folder-1", "mygroup", 0, rule)
	assert.Error(t, err)
}

func TestSequenceName_StableAcrossInvocations(t *testing.T) {
	name1 := SequenceName("default", "folder-1", "mygroup")
	name2 := SequenceName("default", "folder-1", "mygroup")
	assert.Equal(t, name1, name2)
}

func TestSequenceName_DiffersFromRuleName(t *testing.T) {
	rule := PrometheusRule{Alert: "X", Expr: "up"}
	ruleName, _ := RuleName("default", "folder-1", "mygroup", 0, rule)
	seqName := SequenceName("default", "folder-1", "mygroup")
	assert.NotEqual(t, ruleName, seqName)
}
