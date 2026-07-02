package prom

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	prom_model "github.com/prometheus/common/model"

	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/util"
)

// K8sConverter translates Prometheus rule groups/rules into Kubernetes-native
// AlertRuleSpec, RecordingRuleSpec, and RuleSequenceSpec resources. It is the
// counterpart of the legacy Converter (convert.go) which produces models.AlertRule
// objects for the database-backed provisioning path.
//
// The two converters produce semantically identical query graphs so that switching
// between the legacy and k8s code paths (gated by the
// alertingConvertPrometheusViaKubernetesAPI feature flag) does not change rule behaviour.

const (
	// Annotation / label keys used by the k8s conversion path.

	// GroupNameLabelKey labels each created resource with the Prometheus group name it
	// was imported from. Combined with the folder annotation this uniquely identifies the
	// import group, allowing the handler to prune stale rules on re-import.
	GroupNameLabelKey = "alerting.grafana.app/group-name"

	// JSON model defaults injected by AlertQuery.InitDefaults in the legacy storage layer.
	k8sDefaultMaxDataPoints float64 = 43200
	k8sDefaultIntervalMS    float64 = 1000
)

// K8sConverterConfig holds the configuration needed to translate Prometheus rule
// entries into k8s AlertRule / RecordingRule specs.
type K8sConverterConfig struct {
	DatasourceUID       string
	DatasourceType      string
	TargetDatasourceUID string
	// TargetDatasourceType is validated for recording rules (must be
	// Prometheus-compatible). Defaults to DatasourceType if empty.
	TargetDatasourceType string
	DefaultInterval      time.Duration
	FromTimeRange        time.Duration
	EvaluationOffset     time.Duration
	NoDataState          alertingv0.AlertRuleNoDataState
	ExecErrState         alertingv0.AlertRuleExecErrState
	// PauseAlertRules, if true, sets Paused=true on every alerting rule spec.
	PauseAlertRules bool
	// PauseRecordingRules, if true, sets Paused=true on every recording rule spec.
	PauseRecordingRules bool
	// ExtraLabels are merged into every alerting rule's spec labels with the
	// lowest precedence (group labels and rule labels override).
	ExtraLabels map[string]string
}

func (c K8sConverterConfig) withDefaults() K8sConverterConfig {
	if c.DatasourceType == "" {
		c.DatasourceType = datasources.DS_PROMETHEUS
	}
	if c.TargetDatasourceUID == "" {
		c.TargetDatasourceUID = c.DatasourceUID
	}
	if c.TargetDatasourceType == "" {
		c.TargetDatasourceType = c.DatasourceType
	}
	if c.DefaultInterval == 0 {
		c.DefaultInterval = time.Minute
	}
	if c.FromTimeRange == 0 {
		c.FromTimeRange = DefaultFromTimeRange
	}
	if c.NoDataState == "" {
		c.NoDataState = alertingv0.AlertRuleNoDataStateOk
	}
	if c.ExecErrState == "" {
		c.ExecErrState = alertingv0.AlertRuleExecErrStateOk
	}
	return c
}

func (c K8sConverterConfig) validate() error {
	if c.DatasourceUID == "" {
		return fmt.Errorf("datasource UID is required")
	}
	if c.DatasourceType == "" {
		return fmt.Errorf("datasource type is required")
	}
	if !isConvertibleDatasourceType(c.DatasourceType) {
		return ErrInvalidDatasourceType.Errorf("invalid datasource type: %s, must be prometheus-compatible or loki", c.DatasourceType)
	}
	if c.DefaultInterval == 0 {
		return fmt.Errorf("default evaluation interval is required")
	}
	return nil
}

// K8sConverter builds k8s-native alert/recording rule specs from Prometheus rule
// definitions. It is stateless: all inputs are supplied per call.
type K8sConverter struct {
	cfg K8sConverterConfig
}

func NewK8sConverter(cfg K8sConverterConfig) (*K8sConverter, error) {
	cfg = cfg.withDefaults()
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &K8sConverter{cfg: cfg}, nil
}

// BuildAlertRuleSpec produces the AlertRuleSpec for an alerting rule entry.
// The caller is responsible for ObjectMeta (name, namespace, folder annotation, etc.).
func (c *K8sConverter) BuildAlertRuleSpec(group PrometheusRuleGroup, rule PrometheusRule) (alertingv0.AlertRuleSpec, error) {
	if rule.Alert == "" {
		return alertingv0.AlertRuleSpec{}, fmt.Errorf("not an alerting rule")
	}
	interval := c.groupInterval(group.Interval)

	expressions, err := c.buildAlertingExpressions(rule.Expr, group)
	if err != nil {
		return alertingv0.AlertRuleSpec{}, err
	}
	// Trigger.Interval is formatted via prom_model.Duration.String() (e.g. "1m"), not
	// Go's time.Duration.String() (e.g. "1m0s"), to match the compat layer.
	// Extra labels have lowest precedence, then group, then rule.
	merged := mergeLabels(c.cfg.ExtraLabels, mergeLabels(group.Labels, rule.Labels))

	spec := alertingv0.AlertRuleSpec{
		Title:        rule.Alert,
		Trigger:      alertingv0.AlertRuleIntervalTrigger{Interval: alertingv0.AlertRulePromDuration(prom_model.Duration(interval).String())},
		NoDataState:  c.cfg.NoDataState,
		ExecErrState: c.cfg.ExecErrState,
		Expressions:  expressions,
		Labels:       toAlertTemplateLabels(merged),
		Annotations:  toAlertTemplateLabels(rule.Annotations),
	}
	// MissingSeriesEvalsToResolve=1 mirrors Prometheus' "alert resolves as soon as
	// series disappears" semantics.
	one := int64(1)
	spec.MissingSeriesEvalsToResolve = &one

	if c.cfg.PauseAlertRules {
		paused := true
		spec.Paused = &paused
	}
	if rule.For != nil {
		canonical := k8sCanonicalDuration(*rule.For)
		spec.For = &canonical
	}
	if rule.KeepFiringFor != nil {
		canonical := k8sCanonicalDuration(*rule.KeepFiringFor)
		spec.KeepFiringFor = &canonical
	}
	return spec, nil
}

// BuildRecordingRuleSpec produces the RecordingRuleSpec for a recording rule entry.
func (c *K8sConverter) BuildRecordingRuleSpec(group PrometheusRuleGroup, rule PrometheusRule) (alertingv0.RecordingRuleSpec, error) {
	if rule.Record == "" {
		return alertingv0.RecordingRuleSpec{}, fmt.Errorf("not a recording rule")
	}
	if !isPrometheusCompatibleDatasourceType(c.cfg.TargetDatasourceType) {
		return alertingv0.RecordingRuleSpec{}, ErrInvalidTargetDatasourceType.Errorf(
			"invalid target datasource type: %s, must be prometheus-compatible", c.cfg.TargetDatasourceType)
	}
	interval := c.groupInterval(group.Interval)

	expressions, err := c.buildRecordingExpressions(rule.Expr, group)
	if err != nil {
		return alertingv0.RecordingRuleSpec{}, err
	}
	spec := alertingv0.RecordingRuleSpec{
		Title:               rule.Record,
		Metric:              alertingv0.RecordingRuleMetricName(rule.Record),
		Trigger:             alertingv0.RecordingRuleIntervalTrigger{Interval: alertingv0.RecordingRulePromDuration(prom_model.Duration(interval).String())},
		TargetDatasourceUID: alertingv0.RecordingRuleDatasourceUID(c.cfg.TargetDatasourceUID),
		Expressions:         expressions,
		Labels:              toRecordingTemplateLabels(mergeLabels(group.Labels, rule.Labels)),
	}
	if c.cfg.PauseRecordingRules {
		paused := true
		spec.Paused = &paused
	}
	return spec, nil
}

// BuildRuleSequenceSpec produces a RuleSequenceSpec for a group that contains
// recording rules. The caller supplies the k8s resource names (metadata.name) of
// the rules that were already created.
func (c *K8sConverter) BuildRuleSequenceSpec(
	group PrometheusRuleGroup,
	recordingRuleNames []string,
	alertRuleNames []string,
) alertingv0.RuleSequenceSpec {
	interval := c.groupInterval(group.Interval)

	recRefs := make([]alertingv0.RuleSequenceRuleRef, 0, len(recordingRuleNames))
	for _, name := range recordingRuleNames {
		recRefs = append(recRefs, alertingv0.RuleSequenceRuleRef{
			Name: alertingv0.RuleSequenceRuleUID(name),
		})
	}

	alertRefs := make([]alertingv0.RuleSequenceRuleRef, 0, len(alertRuleNames))
	for _, name := range alertRuleNames {
		alertRefs = append(alertRefs, alertingv0.RuleSequenceRuleRef{
			Name: alertingv0.RuleSequenceRuleUID(name),
		})
	}

	return alertingv0.RuleSequenceSpec{
		Trigger: alertingv0.RuleSequenceIntervalTrigger{
			Interval: alertingv0.RuleSequencePromDuration(prom_model.Duration(interval).String()),
		},
		RecordingRules: recRefs,
		AlertingRules:  alertRefs,
	}
}

// buildAlertingExpressions produces the three-node query graph used for alerting rules:
//  1. "query": executes the PromQL/LogQL query
//  2. "prometheus_math": math expression that treats any returned value as alerting
//  3. "threshold": greater-than-zero check, marked as the rule's source
func (c *K8sConverter) buildAlertingExpressions(expr string, group PrometheusRuleGroup) (alertingv0.AlertRuleExpressionMap, error) {
	queryNode, err := c.buildAlertQueryNode(expr, group)
	if err != nil {
		return nil, err
	}
	return alertingv0.AlertRuleExpressionMap{
		queryRefID:          queryNode,
		prometheusMathRefID: c.buildAlertMathNode(),
		thresholdRefID:      c.buildAlertThresholdNode(),
	}, nil
}

// buildRecordingExpressions produces a single query node marked as the source.
func (c *K8sConverter) buildRecordingExpressions(expr string, group PrometheusRuleGroup) (alertingv0.RecordingRuleExpressionMap, error) {
	from, to := c.queryRelativeTimeRange(group)
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

// buildAlertQueryNode returns the query node for an alerting rule. It returns
// an error for forward compatibility (e.g. if query-time-range parsing is
// reintroduced); today it cannot fail.
func (c *K8sConverter) buildAlertQueryNode(expr string, group PrometheusRuleGroup) (alertingv0.AlertRuleExpression, error) {
	from, to := c.queryRelativeTimeRange(group)
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

func (c *K8sConverter) buildAlertMathNode() alertingv0.AlertRuleExpression {
	queryType := "math"
	return alertingv0.AlertRuleExpression{
		QueryType: &queryType,
		Model:     c.exprNodeModel(prometheusMathRefID, "math", c.mathExpressionModel()),
	}
}

func (c *K8sConverter) buildAlertThresholdNode() alertingv0.AlertRuleExpression {
	queryType := "threshold"
	source := true
	return alertingv0.AlertRuleExpression{
		QueryType: &queryType,
		Source:    &source,
		Model:     c.exprNodeModel(thresholdRefID, "threshold", c.thresholdExpressionModel()),
	}
}

func (c *K8sConverter) queryNodeModel(expr string) map[string]any {
	m := map[string]any{
		"datasource": map[string]any{
			"type": c.cfg.DatasourceType,
			"uid":  c.cfg.DatasourceUID,
		},
		"expr":          expr,
		"instant":       true,
		"range":         false,
		"refId":         queryRefID,
		"maxDataPoints": k8sDefaultMaxDataPoints,
		"intervalMs":    k8sDefaultIntervalMS,
	}
	if c.cfg.DatasourceType == datasources.DS_LOKI {
		m["queryType"] = "instant"
	}
	return m
}

func (c *K8sConverter) exprNodeModel(refID, nodeType string, extra map[string]any) map[string]any {
	m := map[string]any{
		"datasource": map[string]any{
			"type": "__expr__",
			"uid":  "__expr__",
		},
		"refId":         refID,
		"type":          nodeType,
		"maxDataPoints": k8sDefaultMaxDataPoints,
		"intervalMs":    k8sDefaultIntervalMS,
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func (c *K8sConverter) mathExpressionModel() map[string]any {
	return map[string]any{
		"expression": fmt.Sprintf("is_number($%[1]s) || is_nan($%[1]s) || is_inf($%[1]s)", queryRefID),
	}
}

func (c *K8sConverter) thresholdExpressionModel() map[string]any {
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

func (c *K8sConverter) queryNodeQueryType() string {
	if c.cfg.DatasourceType == datasources.DS_LOKI {
		return datasources.DS_LOKI
	}
	return datasources.DS_PROMETHEUS
}

// queryRelativeTimeRange resolves the (from, to) duration strings used on the
// query node. Per-group queryOffset overrides the global EvaluationOffset. The
// returned strings use Go's time.Duration.String() format.
func (c *K8sConverter) queryRelativeTimeRange(group PrometheusRuleGroup) (from, to string) {
	evaluationOffset := c.cfg.EvaluationOffset
	if group.QueryOffset != nil {
		evaluationOffset = time.Duration(*group.QueryOffset)
	}
	return (c.cfg.FromTimeRange + evaluationOffset).String(), evaluationOffset.String()
}

// groupInterval resolves the group's evaluation interval, falling back to the
// converter's DefaultInterval when the group doesn't specify one.
func (c *K8sConverter) groupInterval(d prom_model.Duration) time.Duration {
	if d == 0 {
		return c.cfg.DefaultInterval
	}
	return time.Duration(d)
}

// k8sCanonicalDuration normalises a prommodel.Duration to Go's time.Duration.String()
// format (e.g. prommodel 5m -> "5m0s") to match the compat layer.
func k8sCanonicalDuration(d prom_model.Duration) string {
	return time.Duration(d).String()
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

// mergeLabels merges two label sets, with override winning on conflict. Used
// to layer rule labels over group labels (and group+rule over extra labels),
// matching Prometheus' inner-scope-wins semantics.
func mergeLabels(base, override map[string]string) map[string]string {
	if len(base) == 0 && len(override) == 0 {
		return nil
	}
	out := make(map[string]string, len(base)+len(override))
	for k, v := range base {
		out[k] = v
	}
	for k, v := range override {
		out[k] = v
	}
	return out
}

// RuleName produces a deterministic, DNS-1123 compliant metadata.name for a
// rule created by the k8s conversion path. If the rule carries the special
// __grafana_alert_rule_uid__ label, that value is validated and used as-is
// (matching the legacy converter's getUID behaviour). Otherwise a stable UUID
// is derived from the k8s namespace, folder UID, group name, and position
// index. Including folderUID prevents collisions when the same group name
// appears in different folders.
//
// The hash inputs deliberately differ from the legacy getUID
// (orgID|namespaceUID|group|position) because this path operates in k8s
// namespace terms, not org-ID terms. The two paths produce different UUIDs
// for the same logical rule. This is intentional: legacy rules live in the
// database while k8s rules live in unified storage, so name overlap would be
// meaningless. Do not "unify" the hash inputs without migrating all existing
// k8s-path resources.
func RuleName(k8sNamespace, folderUID, groupName string, position int, rule PrometheusRule) (string, error) {
	if uid, ok := rule.Labels[ruleUIDLabel]; ok && uid != "" {
		if err := util.ValidateUID(uid); err != nil {
			return "", fmt.Errorf("invalid %s label value %q: %w", ruleUIDLabel, uid, err)
		}
		return uid, nil
	}
	data := fmt.Sprintf("%s|%s|%s|%d", k8sNamespace, folderUID, groupName, position)
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(data)).String(), nil
}

// SequenceName produces a deterministic, DNS-1123 compliant metadata.name for
// a RuleSequence created by the k8s conversion path. Includes folderUID to
// avoid collisions across folders.
func SequenceName(k8sNamespace, folderUID, groupName string) string {
	data := fmt.Sprintf("seq|%s|%s|%s", k8sNamespace, folderUID, groupName)
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(data)).String()
}
