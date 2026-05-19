package prometheusrulefile

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

func TestConverterDefaults(t *testing.T) {
	cfg := ConverterConfig{DatasourceUID: "ds-123"}.Defaults()
	assert.Equal(t, "prometheus", cfg.DatasourceType)
	assert.Equal(t, "ds-123", cfg.TargetDatasourceUID, "TargetDatasourceUID should default to DatasourceUID")
	assert.Equal(t, time.Minute, cfg.DefaultInterval)
	assert.Equal(t, 600*time.Second, cfg.FromTimeRange)
	assert.Equal(t, alertingv0.AlertRuleNoDataStateOk, cfg.NoDataState)
	assert.Equal(t, alertingv0.AlertRuleExecErrStateOk, cfg.ExecErrState)
}

func TestBuildAlertRuleSpec_ThreeNodeQueryGraph(t *testing.T) {
	c := NewConverter(ConverterConfig{DatasourceUID: "ds-prom", DatasourceType: "prometheus"})
	alertName := "HighRequestRate"
	forD := model.PrometheusRuleFilePromDuration("5m")
	group := model.PrometheusRuleFilePrometheusRuleGroup{
		Name: "group-1",
	}
	rule := model.PrometheusRuleFileRuleEntry{
		Alert:       &alertName,
		Expr:        `sum(rate(http_requests_total[5m])) > 100`,
		For:         &forD,
		Labels:      map[string]string{"severity": "page"},
		Annotations: map[string]string{"summary": "request rate too high"},
	}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)

	assert.Equal(t, alertName, spec.Title)
	assert.Equal(t, alertingv0.AlertRulePromDuration("1m"), spec.Trigger.Interval, "default group interval rendered prom-style")
	assert.NotNil(t, spec.For)
	assert.Equal(t, "5m0s", *spec.For, "For uses Go time.Duration.String() to match compat-layer output")

	// Three nodes: query / prometheus_math / threshold.
	require.Len(t, spec.Expressions, 3)
	queryNode := spec.Expressions[queryRefID]
	require.NotNil(t, queryNode.DatasourceUID)
	assert.Equal(t, "ds-prom", string(*queryNode.DatasourceUID))
	require.NotNil(t, queryNode.QueryType)
	assert.Equal(t, "prometheus", *queryNode.QueryType)
	require.NotNil(t, queryNode.RelativeTimeRange)
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("10m0s"), queryNode.RelativeTimeRange.From, "default FromTimeRange=600s + offset=0 → 10m0s")
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("0s"), queryNode.RelativeTimeRange.To)
	// Source must be set on the *threshold* node, never on query/math.
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
	assert.True(t, *thresholdNode.Source, "threshold must be the rule's source so domain conversion picks the right RefID")
}

func TestBuildAlertRuleSpec_GroupQueryOffsetOverridesGlobal(t *testing.T) {
	c := NewConverter(ConverterConfig{
		DatasourceUID:    "ds-prom",
		EvaluationOffset: 30 * time.Second,
	})
	off := model.PrometheusRuleFilePromDuration("2m")
	alertName := "X"
	group := model.PrometheusRuleFilePrometheusRuleGroup{Name: "g", QueryOffset: &off}
	rule := model.PrometheusRuleFileRuleEntry{Alert: &alertName, Expr: "up"}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)
	queryNode := spec.Expressions[queryRefID]
	require.NotNil(t, queryNode.RelativeTimeRange)
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("12m0s"), queryNode.RelativeTimeRange.From, "from = FromTimeRange + group queryOffset (10m + 2m = 12m)")
	assert.Equal(t, alertingv0.AlertRulePromDurationWMillis("2m0s"), queryNode.RelativeTimeRange.To, "to = group queryOffset, overriding the global EvaluationOffset")
}

func TestBuildRecordingRuleSpec_SingleQueryNodeIsSource(t *testing.T) {
	c := NewConverter(ConverterConfig{DatasourceUID: "ds-prom", TargetDatasourceUID: "ds-target"})
	metricName := "http_request_rate:sum"
	group := model.PrometheusRuleFilePrometheusRuleGroup{Name: "g"}
	rule := model.PrometheusRuleFileRuleEntry{
		Record: &metricName,
		Expr:   `sum(rate(http_requests_total[1m]))`,
		Labels: map[string]string{"team": "core"},
	}

	spec, err := c.BuildRecordingRuleSpec(group, rule)
	require.NoError(t, err)

	assert.Equal(t, metricName, spec.Title)
	assert.Equal(t, alertingv0.RecordingRuleMetricName(metricName), spec.Metric)
	assert.Equal(t, alertingv0.RecordingRuleDatasourceUID("ds-target"), spec.TargetDatasourceUID)

	require.Len(t, spec.Expressions, 1, "recording rules have a single query node — no math/threshold")
	node := spec.Expressions[queryRefID]
	require.NotNil(t, node.Source)
	assert.True(t, *node.Source)
	require.NotNil(t, node.DatasourceUID)
	assert.Equal(t, "ds-prom", string(*node.DatasourceUID))
}

func TestBuildAlertRuleSpec_GroupLabelsMergeWithRuleLabels(t *testing.T) {
	c := NewConverter(ConverterConfig{DatasourceUID: "ds-prom"})
	alertName := "X"
	group := model.PrometheusRuleFilePrometheusRuleGroup{
		Name:   "g",
		Labels: map[string]string{"severity": "warning", "team": "core"},
	}
	rule := model.PrometheusRuleFileRuleEntry{
		Alert:  &alertName,
		Expr:   "up == 0",
		Labels: map[string]string{"severity": "critical"},
	}

	spec, err := c.BuildAlertRuleSpec(group, rule)
	require.NoError(t, err)
	// Rule-level wins on conflict; group-only entries survive.
	assert.Equal(t, alertingv0.AlertRuleTemplateString("critical"), spec.Labels["severity"])
	assert.Equal(t, alertingv0.AlertRuleTemplateString("core"), spec.Labels["team"])
}

func TestBuildAlertRuleSpec_RejectsRecordingEntry(t *testing.T) {
	c := NewConverter(ConverterConfig{DatasourceUID: "ds-prom"})
	metric := "x"
	_, err := c.BuildAlertRuleSpec(
		model.PrometheusRuleFilePrometheusRuleGroup{Name: "g"},
		model.PrometheusRuleFileRuleEntry{Record: &metric, Expr: "x"},
	)
	assert.Error(t, err)
}

func TestBuildRecordingRuleSpec_RejectsAlertingEntry(t *testing.T) {
	c := NewConverter(ConverterConfig{DatasourceUID: "ds-prom"})
	alert := "x"
	_, err := c.BuildRecordingRuleSpec(
		model.PrometheusRuleFilePrometheusRuleGroup{Name: "g"},
		model.PrometheusRuleFileRuleEntry{Alert: &alert, Expr: "x"},
	)
	assert.Error(t, err)
}

func TestBuildAlertRuleSpec_LokiDatasourceQueryTypeInModel(t *testing.T) {
	c := NewConverter(ConverterConfig{DatasourceUID: "ds-loki", DatasourceType: "loki"})
	alert := "X"
	spec, err := c.BuildAlertRuleSpec(
		model.PrometheusRuleFilePrometheusRuleGroup{Name: "g"},
		model.PrometheusRuleFileRuleEntry{Alert: &alert, Expr: `{job="x"} |= "err"`},
	)
	require.NoError(t, err)

	queryNode := spec.Expressions[queryRefID]
	require.NotNil(t, queryNode.QueryType)
	assert.Equal(t, "loki", *queryNode.QueryType)
	m, ok := queryNode.Model.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "instant", m["queryType"], "Loki query nodes carry an `instant` queryType inside the model JSON to match the prom converter")
}
