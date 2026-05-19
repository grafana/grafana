package prometheusrulefile

import (
	"fmt"
	"time"

	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

// Conversion is intentionally kept in lock-step with Grafana's
// pkg/services/ngalert/prom.Converter so that a PrometheusRuleFile reconciled by this app
// produces semantically identical AlertRule / RecordingRule resources to those that
// pkg/services/ngalert/api_convert_prometheus.go would produce when it accepts a Prometheus
// rule group via the /convert HTTP API.
//
// The two implementations are validated against each other in
// pkg/registry/apps/alerting/rules-extensions/converter_xref_test.go, which runs the same
// input through both paths and asserts the resulting domain models match. Keep that test
// green when modifying anything in this file.

const (
	// Datasource-engine UIDs and ref IDs. These are reproduced verbatim (not imported) so the
	// rules-extensions Go module can stay free of Grafana's internal `pkg/expr` dependency.
	exprDatasourceType = "__expr__"
	exprDatasourceUID  = "__expr__"

	queryRefID          = "query"
	prometheusMathRefID = "prometheus_math"
	thresholdRefID      = "threshold"

	// JSON model defaults injected by AlertQuery.InitDefaults in the legacy storage layer.
	defaultMaxDataPoints float64 = 43200
	defaultIntervalMS    float64 = 1000

	// Datasource type names (avoid importing pkg/services/datasources).
	datasourceTypePrometheus = "prometheus"
	datasourceTypeLoki       = "loki"

	// Default time range applied to the query node when the file does not pin a value.
	defaultFromTimeRange = 600 * time.Second
)

// ConverterConfig holds the configuration the reconciler needs to translate Prometheus rule
// entries into AlertRule / RecordingRule resources. Fields mirror the relevant subset of
// pkg/services/ngalert/prom.Config so the two implementations stay aligned.
type ConverterConfig struct {
	// DatasourceUID is the UID of the datasource the rules are querying.
	DatasourceUID string
	// DatasourceType is the type of the datasource (prometheus or loki). Defaults to "prometheus".
	DatasourceType string
	// TargetDatasourceUID is the UID written into RecordingRule's TargetDatasourceUID. If empty,
	// DatasourceUID is reused.
	TargetDatasourceUID string
	// DefaultInterval is applied to groups that do not specify their own interval.
	DefaultInterval time.Duration
	// FromTimeRange is the relative-time-range `from` distance used on the query node. Defaults
	// to 600s, matching the prom converter.
	FromTimeRange time.Duration
	// EvaluationOffset is the global evaluation offset. Overridden per-group by
	// PrometheusRuleGroup.queryOffset.
	EvaluationOffset time.Duration
	// NoDataState / ExecErrState are stamped onto every AlertRule. Defaults are "OK" / "OK"
	// to match the prom converter's defaultConfig.
	NoDataState  alertingv0.AlertRuleNoDataState
	ExecErrState alertingv0.AlertRuleExecErrState
}

// Defaults fills in any zero-value fields with the same defaults the prom converter uses.
func (c ConverterConfig) Defaults() ConverterConfig {
	if c.DatasourceType == "" {
		c.DatasourceType = datasourceTypePrometheus
	}
	if c.TargetDatasourceUID == "" {
		c.TargetDatasourceUID = c.DatasourceUID
	}
	if c.DefaultInterval == 0 {
		c.DefaultInterval = time.Minute
	}
	if c.FromTimeRange == 0 {
		c.FromTimeRange = defaultFromTimeRange
	}
	if c.NoDataState == "" {
		c.NoDataState = alertingv0.AlertRuleNoDataStateOk
	}
	if c.ExecErrState == "" {
		c.ExecErrState = alertingv0.AlertRuleExecErrStateOk
	}
	return c
}

// Converter is the rules-extensions implementation of the Prom → Grafana rule translation.
// It is deliberately stateless — every input is supplied per call so the same instance can
// be reused for every reconcile.
type Converter struct {
	cfg ConverterConfig
}

func NewConverter(cfg ConverterConfig) *Converter {
	return &Converter{cfg: cfg.Defaults()}
}

// BuildAlertRuleSpec produces the AlertRuleSpec for an alerting rule entry. Caller is
// responsible for ObjectMeta (name, namespace, folder annotation, etc.) — this function
// only owns the spec.
func (c *Converter) BuildAlertRuleSpec(group model.PrometheusRuleFilePrometheusRuleGroup, rule model.PrometheusRuleFileRuleEntry) (alertingv0.AlertRuleSpec, error) {
	if rule.Alert == nil || *rule.Alert == "" {
		return alertingv0.AlertRuleSpec{}, fmt.Errorf("not an alerting rule")
	}
	interval, err := c.groupInterval(group.Interval)
	if err != nil {
		return alertingv0.AlertRuleSpec{}, err
	}
	expressions, err := c.buildAlertingExpressions(rule.Expr, group)
	if err != nil {
		return alertingv0.AlertRuleSpec{}, err
	}
	// Trigger.Interval is formatted via prom_model.Duration.String() (e.g. "1m"), not Go's
	// time.Duration.String() (e.g. "1m0s"), to match the compat layer which does
	// prom_model.ParseDuration("<n>s").String() before stamping it onto the k8s spec.
	spec := alertingv0.AlertRuleSpec{
		Title:        *rule.Alert,
		Trigger:      alertingv0.AlertRuleIntervalTrigger{Interval: alertingv0.AlertRulePromDuration(prom_model.Duration(interval).String())},
		NoDataState:  c.cfg.NoDataState,
		ExecErrState: c.cfg.ExecErrState,
		Expressions:  expressions,
		Labels:       toAlertTemplateLabels(mergeStringMaps(group.Labels, rule.Labels)),
		Annotations:  toAlertTemplateLabels(rule.Annotations),
	}
	// MissingSeriesEvalsToResolve=1 mirrors Prometheus' "alert resolves as soon as series
	// disappears" semantics. The prom converter sets the same value.
	one := int64(1)
	spec.MissingSeriesEvalsToResolve = &one

	if rule.For != nil {
		// Normalize via prom_model.ParseDuration so we end up with the same canonical string
		// (e.g. "60s" → "1m") the prom converter would emit.
		canonical, err := canonicalDuration(string(*rule.For))
		if err != nil {
			return alertingv0.AlertRuleSpec{}, fmt.Errorf("for: %w", err)
		}
		spec.For = &canonical
	}
	if rule.KeepFiringFor != nil {
		canonical, err := canonicalDuration(string(*rule.KeepFiringFor))
		if err != nil {
			return alertingv0.AlertRuleSpec{}, fmt.Errorf("keepFiringFor: %w", err)
		}
		spec.KeepFiringFor = &canonical
	}
	return spec, nil
}

// BuildRecordingRuleSpec produces the RecordingRuleSpec for a recording rule entry.
func (c *Converter) BuildRecordingRuleSpec(group model.PrometheusRuleFilePrometheusRuleGroup, rule model.PrometheusRuleFileRuleEntry) (alertingv0.RecordingRuleSpec, error) {
	if rule.Record == nil || *rule.Record == "" {
		return alertingv0.RecordingRuleSpec{}, fmt.Errorf("not a recording rule")
	}
	interval, err := c.groupInterval(group.Interval)
	if err != nil {
		return alertingv0.RecordingRuleSpec{}, err
	}
	expressions, err := c.buildRecordingExpressions(rule.Expr, group)
	if err != nil {
		return alertingv0.RecordingRuleSpec{}, err
	}
	return alertingv0.RecordingRuleSpec{
		Title:               *rule.Record,
		Metric:              alertingv0.RecordingRuleMetricName(*rule.Record),
		Trigger:             alertingv0.RecordingRuleIntervalTrigger{Interval: alertingv0.RecordingRulePromDuration(prom_model.Duration(interval).String())},
		TargetDatasourceUID: alertingv0.RecordingRuleDatasourceUID(c.cfg.TargetDatasourceUID),
		Expressions:         expressions,
		Labels:              toRecordingTemplateLabels(mergeStringMaps(group.Labels, rule.Labels)),
	}, nil
}

// buildAlertingExpressions produces the three-node query graph used for alerting rules:
//
//  1. "query": Executes the PromQL/LogQL query against the configured datasource.
//  2. "prometheus_math": Applies a math expression that succeeds for any numeric, NaN, or
//     Inf value — i.e. anything the datasource returned is treated as alerting.
//  3. "threshold": Greater-than-zero check on the math output. Marked as the rule's source.
//
// This mirrors pkg/services/ngalert/prom.Converter.createQuery exactly.
func (c *Converter) buildAlertingExpressions(expr string, group model.PrometheusRuleFilePrometheusRuleGroup) (alertingv0.AlertRuleExpressionMap, error) {
	queryNode, err := c.buildAlertQueryNode(expr, group)
	if err != nil {
		return nil, err
	}
	out := alertingv0.AlertRuleExpressionMap{
		queryRefID:          queryNode,
		prometheusMathRefID: c.buildAlertMathNode(),
		thresholdRefID:      c.buildAlertThresholdNode(),
	}
	return out, nil
}

// buildRecordingExpressions produces the single query node used for recording rules. The
// node is marked as the source.
func (c *Converter) buildRecordingExpressions(expr string, group model.PrometheusRuleFilePrometheusRuleGroup) (alertingv0.RecordingRuleExpressionMap, error) {
	from, to, err := c.queryRelativeTimeRange(group)
	if err != nil {
		return nil, err
	}
	dsUID := alertingv0.RecordingRuleDatasourceUID(c.cfg.DatasourceUID)
	source := true
	queryType := c.queryNodeQueryType()

	return alertingv0.RecordingRuleExpressionMap{
		queryRefID: {
			DatasourceUID: &dsUID,
			QueryType:     &queryType,
			RelativeTimeRange: &alertingv0.RecordingRuleRelativeTimeRange{
				From: alertingv0.RecordingRulePromDurationWMillis(from),
				To:   alertingv0.RecordingRulePromDurationWMillis(to),
			},
			Model:  c.queryNodeModel(expr),
			Source: &source,
		},
	}, nil
}

func (c *Converter) buildAlertQueryNode(expr string, group model.PrometheusRuleFilePrometheusRuleGroup) (alertingv0.AlertRuleExpression, error) {
	from, to, err := c.queryRelativeTimeRange(group)
	if err != nil {
		return alertingv0.AlertRuleExpression{}, err
	}
	dsUID := alertingv0.AlertRuleDatasourceUID(c.cfg.DatasourceUID)
	queryType := c.queryNodeQueryType()
	return alertingv0.AlertRuleExpression{
		DatasourceUID: &dsUID,
		QueryType:     &queryType,
		RelativeTimeRange: &alertingv0.AlertRuleRelativeTimeRange{
			From: alertingv0.AlertRulePromDurationWMillis(from),
			To:   alertingv0.AlertRulePromDurationWMillis(to),
		},
		Model: c.queryNodeModel(expr),
	}, nil
}

func (c *Converter) buildAlertMathNode() alertingv0.AlertRuleExpression {
	queryType := "math"
	return alertingv0.AlertRuleExpression{
		// DatasourceUID is intentionally nil — the math node runs on the expr engine, and the
		// compat layer omits DatasourceUID for expr-typed expressions.
		QueryType: &queryType,
		Model:     c.exprNodeModel(prometheusMathRefID, "math", c.mathExpressionModel()),
	}
}

func (c *Converter) buildAlertThresholdNode() alertingv0.AlertRuleExpression {
	queryType := "threshold"
	source := true
	return alertingv0.AlertRuleExpression{
		QueryType: &queryType,
		Source:    &source,
		Model:     c.exprNodeModel(thresholdRefID, "threshold", c.thresholdExpressionModel()),
	}
}

// queryNodeModel returns the JSON-marshalable map representing the PromQL/LogQL query node's
// `Model` field. It mirrors the layout produced by ngalert/prom.createQueryNode followed by
// AlertQuery.InitDefaults (which injects maxDataPoints, intervalMs, refId).
func (c *Converter) queryNodeModel(expr string) map[string]any {
	m := map[string]any{
		"datasource": map[string]any{
			"type": c.cfg.DatasourceType,
			"uid":  c.cfg.DatasourceUID,
		},
		"expr":          expr,
		"instant":       true,
		"range":         false,
		"refId":         queryRefID,
		"maxDataPoints": defaultMaxDataPoints,
		"intervalMs":    defaultIntervalMS,
	}
	if c.cfg.DatasourceType == datasourceTypeLoki {
		// Loki query nodes ride the "instant" queryType the prom converter assigns. The
		// converter writes `queryType: "instant"` into the model in addition to the AlertQuery
		// QueryType field set to "loki" — preserve that here.
		m["queryType"] = "instant"
	}
	return m
}

// exprNodeModel returns the JSON map for an expr engine node (math or threshold). It mirrors
// the layout produced by createMathNode / createThresholdNode after InitDefaults runs.
func (c *Converter) exprNodeModel(refID, nodeType string, extra map[string]any) map[string]any {
	m := map[string]any{
		"datasource": map[string]any{
			"type": exprDatasourceType,
			"uid":  exprDatasourceUID,
		},
		"refId":         refID,
		"type":          nodeType,
		"maxDataPoints": defaultMaxDataPoints,
		"intervalMs":    defaultIntervalMS,
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func (c *Converter) mathExpressionModel() map[string]any {
	return map[string]any{
		"expression": fmt.Sprintf("is_number($%[1]s) || is_nan($%[1]s) || is_inf($%[1]s)", queryRefID),
	}
}

func (c *Converter) thresholdExpressionModel() map[string]any {
	return map[string]any{
		"expression": prometheusMathRefID,
		"conditions": []any{
			map[string]any{
				"evaluator": map[string]any{
					"type":   "gt",
					"params": []any{float64(0)},
				},
			},
		},
	}
}

func (c *Converter) queryNodeQueryType() string {
	if c.cfg.DatasourceType == datasourceTypeLoki {
		return datasourceTypeLoki
	}
	return datasourceTypePrometheus
}

// queryRelativeTimeRange resolves the (from, to) durations used on the query node, applying
// the per-group `queryOffset` override if present. The returned strings use Go's
// time.Duration.String() format because the compat layer goes through models.Duration
// (= time.Duration) and emits it via the same `.String()` method.
func (c *Converter) queryRelativeTimeRange(group model.PrometheusRuleFilePrometheusRuleGroup) (from, to string, _ error) {
	evaluationOffset := c.cfg.EvaluationOffset
	if group.QueryOffset != nil {
		d, err := prom_model.ParseDuration(string(*group.QueryOffset))
		if err != nil {
			return "", "", fmt.Errorf("invalid queryOffset: %w", err)
		}
		evaluationOffset = time.Duration(d)
	}
	return (c.cfg.FromTimeRange + evaluationOffset).String(), evaluationOffset.String(), nil
}

// groupInterval resolves the group's evaluation interval, falling back to the converter's
// DefaultInterval when the spec doesn't pin one.
func (c *Converter) groupInterval(d *model.PrometheusRuleFilePromDuration) (time.Duration, error) {
	if d == nil || *d == "" {
		return c.cfg.DefaultInterval, nil
	}
	parsed, err := prom_model.ParseDuration(string(*d))
	if err != nil {
		return 0, fmt.Errorf("invalid group interval: %w", err)
	}
	return time.Duration(parsed), nil
}

// canonicalDuration normalises a Prometheus duration to the form `time.Duration.String()`
// emits (e.g. "60s" → "1m0s"). The compat layer stores rule.For / rule.KeepFiringFor on
// the domain model as time.Duration and then calls `.String()` when stamping it onto the
// k8s AlertRuleSpec, so producing the same Go-style format here keeps the two converters
// emitting byte-identical specs.
func canonicalDuration(s string) (string, error) {
	d, err := prom_model.ParseDuration(s)
	if err != nil {
		return "", err
	}
	return time.Duration(d).String(), nil
}

func toAlertTemplateLabels(in map[string]string) map[string]alertingv0.AlertRuleTemplateString {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]alertingv0.AlertRuleTemplateString, len(in))
	for k, v := range in {
		out[k] = alertingv0.AlertRuleTemplateString(v)
	}
	return out
}

func toRecordingTemplateLabels(in map[string]string) map[string]alertingv0.RecordingRuleTemplateString {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]alertingv0.RecordingRuleTemplateString, len(in))
	for k, v := range in {
		out[k] = alertingv0.RecordingRuleTemplateString(v)
	}
	return out
}
