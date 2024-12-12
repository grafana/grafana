package prom

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/datasources"
	prommodel "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Config struct {
	DatasourceUID    string
	DatasourceType   string
	FromTimeRange    *time.Duration
	EvaluationOffset *time.Duration
	ExecErrState     models.ExecutionErrorState
	NoDataState      models.NoDataState
	DefaultInterval  *time.Duration
	RecordingRules   RulesConfig
	AlertRules       RulesConfig
}

type RulesConfig struct {
	IsPaused bool
}

var (
	defaultTimeRange        = 600 * time.Second
	defaultInterval         = 60 * time.Second
	defaultEvaluationOffset = 1 * time.Minute

	defaultConfig = Config{
		DatasourceUID:    "grafanacloud-prom",
		DatasourceType:   "prometheus",
		FromTimeRange:    &defaultTimeRange,
		EvaluationOffset: &defaultEvaluationOffset,
		ExecErrState:     models.ErrorErrState,
		NoDataState:      models.NoData,
		DefaultInterval:  &defaultInterval,
	}
)

type Converter struct {
	cfg Config
}

func NewConverter(cfg Config) (*Converter, error) {
	if cfg.DatasourceUID == "" {
		cfg.DatasourceUID = defaultConfig.DatasourceUID
	}
	if cfg.DatasourceType == "" {
		cfg.DatasourceType = defaultConfig.DatasourceType
	}
	if cfg.FromTimeRange == nil {
		cfg.FromTimeRange = defaultConfig.FromTimeRange
	}
	if cfg.EvaluationOffset == nil {
		cfg.EvaluationOffset = defaultConfig.EvaluationOffset
	}
	if cfg.ExecErrState == "" {
		cfg.ExecErrState = defaultConfig.ExecErrState
	}
	if cfg.NoDataState == "" {
		cfg.NoDataState = defaultConfig.NoDataState
	}
	if cfg.DefaultInterval == nil {
		cfg.DefaultInterval = defaultConfig.DefaultInterval
	}

	if cfg.DatasourceType != datasources.DS_PROMETHEUS && cfg.DatasourceType != datasources.DS_LOKI {
		return nil, fmt.Errorf("invalid datasource type: %s", cfg.DatasourceType)
	}

	return &Converter{
		cfg: cfg,
	}, nil
}

// PrometheusRulesToGrafana converts Prometheus rule groups into Grafana alert rule group.
func (p *Converter) PrometheusRulesToGrafana(orgID int64, namespaceUID string, group PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	for _, rule := range group.Rules {
		err := validatePrometheusRule(rule)
		if err != nil {
			return nil, fmt.Errorf("invalid Prometheus rule '%s': %w", rule.Alert, err)
		}
	}

	grafanaGroup, err := p.convertRuleGroup(orgID, namespaceUID, group)
	if err != nil {
		return nil, fmt.Errorf("failed to convert rule group '%s': %w", group.Name, err)
	}

	return grafanaGroup, nil
}

func (p *Converter) GrafanaRulesToPrometheus(group *models.AlertRuleGroup) (PrometheusRuleGroup, error) {
	prometheusGroup, err := p.convertRuleGroupToPrometheus(group)
	if err != nil {
		return PrometheusRuleGroup{}, fmt.Errorf("failed to convert rule group '%s': %w", group.Title, err)
	}

	return prometheusGroup, nil
}

func validatePrometheusRule(rule PrometheusRule) error {
	if rule.KeepFiringFor != "" {
		return fmt.Errorf("keep_firing_for is not supported")
	}

	return nil
}

func (p *Converter) convertRuleGroup(orgID int64, namespaceUID string, promGroup PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	duration, err := parseDurationOrDefault(promGroup.Interval, *p.cfg.DefaultInterval)
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval '%s': %w", promGroup.Interval, err)
	}

	uniqueNames := map[string]int{}
	rules := make([]models.AlertRule, 0, len(promGroup.Rules))
	for i, rule := range promGroup.Rules {
		gr, err := p.convertRule(orgID, namespaceUID, promGroup.Name, rule)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Prometheus rule '%s' to Grafana rule: %w", rule.Alert, err)
		}
		gr.RuleGroupIndex = i + 1
		gr.IntervalSeconds = int64(duration.Seconds())

		// In Grafana rule titles must be unique within the namespace.
		// We can't guarantee this on the conversion level. We don't know how many other
		// rules are already in the namespace, so this is the best we can do right now.
		//
		// TODO: move to the saving method and check for duplicates there,
		// adding a suffix to the title if needed.
		//
		uniqueNames[gr.Title]++
		if val := uniqueNames[gr.Title]; val > 1 {
			gr.Title = fmt.Sprintf("%s (%d)", gr.Title, val)
		}

		rules = append(rules, gr)
	}

	result := &models.AlertRuleGroup{
		FolderUID: namespaceUID,
		Interval:  int64(duration.Seconds()),
		Rules:     rules,
		Title:     promGroup.Name,
	}

	return result, nil
}

func (p *Converter) convertRuleGroupToPrometheus(group *models.AlertRuleGroup) (PrometheusRuleGroup, error) {
	rules := make([]PrometheusRule, 0, len(group.Rules))
	for _, rule := range group.Rules {
		conv, err := convertRuleToPrometheus(rule)
		if err != nil {
			return PrometheusRuleGroup{}, err
		}
		rules = append(rules, conv)
	}

	return PrometheusRuleGroup{
		Name:     group.Title,
		Interval: getPromDurationString(time.Duration(group.Interval) * time.Second),
		Rules:    rules,
	}, nil
}

func (p *Converter) convertRule(orgID int64, namespaceUID, group string, rule PrometheusRule) (models.AlertRule, error) {
	forInterval, err := parseDurationOrDefault(rule.For, time.Duration(0))
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to parse for '%s': %w", rule.For, err)
	}
	queryNode, err := createAlertQueryNode(p.cfg.DatasourceUID, p.cfg.DatasourceType, rule.Expr, *p.cfg.FromTimeRange, *p.cfg.EvaluationOffset)
	if err != nil {
		return models.AlertRule{}, err
	}

	var title string
	if rule.Record != "" {
		title = rule.Record
	} else {
		title = rule.Alert
	}

	labels := make(map[string]string, len(rule.Labels)+1)
	for k, v := range rule.Labels {
		labels[k] = v
	}
	labels[models.PrometheusStyleRuleLabel] = "true"

	result := models.AlertRule{
		OrgID:        orgID,
		NamespaceUID: namespaceUID,
		Title:        title,
		Data:         []models.AlertQuery{queryNode},
		Condition:    "A",
		NoDataState:  p.cfg.NoDataState,
		ExecErrState: p.cfg.ExecErrState,
		Annotations:  rule.Annotations,
		Labels:       labels,
		For:          forInterval,
		RuleGroup:    group,
		Metadata: models.AlertRuleMetadata{
			PrometheusStyleRule: true,
		},
	}

	if rule.Record != "" {
		result.Record = &models.Record{
			From:   "A",
			Metric: rule.Record,
		}
		result.IsPaused = p.cfg.RecordingRules.IsPaused
	} else {
		result.IsPaused = p.cfg.AlertRules.IsPaused
	}

	return result, nil
}

func convertRuleToPrometheus(rule models.AlertRule) (PrometheusRule, error) {
	alert := ""
	record := ""
	switch rule.Type() {
	case models.RuleTypeAlerting:
		alert = rule.Title
	case models.RuleTypeRecording:
		record = rule.Record.Metric
	}

	// We "cheat" by finding the first prometheus node and returning its expression without analyzing anything else.
	expr := ""
	for _, aq := range rule.Data {
		nodeExpr, err := tryExtractPromExpr(aq)
		if err != nil {
			return PrometheusRule{}, fmt.Errorf("failed to convert rule '%s': %w", rule.Title, err)
		}
		if nodeExpr != "" {
			expr = nodeExpr
		}
	}
	// Allow expressionless rules through as a hack to deal with non-prom rules.
	/*if expr == "" {
		return PrometheusRule{}, fmt.Errorf("failed to convert rule '%s': no node found with a valid prometheus query", rule.Title)
	}*/

	return PrometheusRule{
		Alert:         alert,
		Record:        record,
		Expr:          expr,
		For:           getPromDurationString(rule.For),
		KeepFiringFor: "",
		Labels:        rule.Labels,
		Annotations:   rule.Annotations,
	}, nil
}

func tryExtractPromExpr(aq models.AlertQuery) (string, error) {
	type datasource struct {
		Type string `json:"type"`
		UID  string `json:"uid"`
	}
	type queryModel struct {
		Datasource datasource `json:"datasource"`
		Expr       string     `json:"expr"`
	}

	var node queryModel
	err := json.Unmarshal(aq.Model, &node)
	if err != nil {
		return "", fmt.Errorf("query deserialization failed: %w", err)
	}
	if node.Datasource.Type == "prometheus" {
		return node.Expr, nil
	}
	return "", nil
}

func parseDurationOrDefault(durationStr string, defaultVal time.Duration) (time.Duration, error) {
	if durationStr == "" {
		return defaultVal, nil
	}

	duration, err := prommodel.ParseDuration(durationStr)
	if err != nil {
		return 0, err
	}
	return time.Duration(duration), nil
}

func getPromDurationString(dur time.Duration) string {
	return prommodel.Duration(dur).String()
}

func createAlertQueryNode(datasourceUID, datasourceType, expr string, fromTimeRange, evaluationOffset time.Duration) (models.AlertQuery, error) {
	modelData := map[string]interface{}{
		"datasource": map[string]interface{}{
			"type": datasourceType,
			"uid":  datasourceUID,
		},
		"editorMode":    "code",
		"expr":          expr,
		"instant":       true,
		"range":         false,
		"intervalMs":    1000,
		"legendFormat":  "__auto",
		"maxDataPoints": 43200,
		"refId":         "A",
	}

	if datasourceType == datasources.DS_LOKI {
		modelData["queryType"] = "instant"
	}

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return models.AlertQuery{}, err
	}

	return models.AlertQuery{
		DatasourceUID: datasourceUID,
		Model:         modelJSON,
		RefID:         "A",
		RelativeTimeRange: models.RelativeTimeRange{
			From: models.Duration(fromTimeRange + evaluationOffset),
			To:   models.Duration(0 + evaluationOffset),
		},
	}, nil
}
