package prom

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Config struct {
	DatasourceUID   string
	Receiver        string
	FromTimeRange   *time.Duration
	ExecErrState    string
	NoDataState     string
	DefaultInterval *time.Duration
}

var (
	defaultTimeRange = 600 * time.Second
	defaultInterval  = 60 * time.Second

	defaultConfig = Config{
		DatasourceUID:   "grafanacloud-prom",
		Receiver:        "grafana-default-email",
		FromTimeRange:   &defaultTimeRange,
		ExecErrState:    "OK",
		NoDataState:     "NoData",
		DefaultInterval: &defaultInterval,
	}
)

type Converter struct {
	cfg Config
}

func NewConverter(cfg Config) *Converter {
	if cfg.DatasourceUID == "" {
		cfg.DatasourceUID = defaultConfig.DatasourceUID
	}
	if cfg.Receiver == "" {
		cfg.Receiver = defaultConfig.Receiver
	}
	if cfg.FromTimeRange == nil {
		cfg.FromTimeRange = defaultConfig.FromTimeRange
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

	return &Converter{
		cfg: cfg,
	}
}

// PrometheusRulesToGrafana converts Prometheus rule groups into Grafana alert rule group.
func (p *Converter) PrometheusRulesToGrafana(orgID int64, namespaceUID string, group PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	for _, rule := range group.Rules {
		err := validatePrometheusRule(rule)
		if err != nil {
			return nil, fmt.Errorf("invalid Prometheus rule '%s': %w", rule.Alert, err)
		}
	}

	grafanaGroup, err := p.convertRuleGroup(orgID, p.cfg.DatasourceUID, namespaceUID, group)
	if err != nil {
		return nil, fmt.Errorf("failed to convert rule group '%s': %w", group.Name, err)
	}

	return grafanaGroup, nil
}

func validatePrometheusRule(rule PrometheusRule) error {
	if rule.KeepFiringFor != "" {
		return fmt.Errorf("keep_firing_for is not supported")
	}

	return nil
}

func (p *Converter) convertRuleGroup(orgID int64, datasourceUID, namespaceUID string, promGroup PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	duration, err := parseDurationOrDefault(promGroup.Interval, *p.cfg.DefaultInterval)
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval '%s': %w", promGroup.Interval, err)
	}

	rules := make([]models.AlertRule, 0, len(promGroup.Rules))
	for i, rule := range promGroup.Rules {
		gr, err := p.convertRule(orgID, datasourceUID, namespaceUID, promGroup.Name, rule)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Prometheus rule '%s' to Grafana rule: %w", rule.Alert, err)
		}
		gr.RuleGroupIndex = i + 1
		gr.IntervalSeconds = int64(duration.Seconds())
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

func (p *Converter) convertRule(orgID int64, datasourceUID, namespaceUID, group string, rule PrometheusRule) (models.AlertRule, error) {
	forInterval, err := parseDurationOrDefault(rule.For, time.Duration(0))
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to parse for '%s': %w", rule.For, err)
	}
	queryNode, err := createAlertQueryNode(datasourceUID, rule.Expr, *p.cfg.FromTimeRange)
	if err != nil {
		return models.AlertRule{}, err
	}

	noDataState, err := models.NoDataStateFromString(p.cfg.NoDataState)
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to parse no_data_state '%s': %w", p.cfg.NoDataState, err)
	}
	execErrState, err := models.ErrStateFromString(p.cfg.ExecErrState)
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to parse exec_err_state '%s': %w", p.cfg.ExecErrState, err)
	}

	var title string
	if rule.Record != "" {
		title = rule.Record
	} else {
		title = rule.Alert
	}

	result := models.AlertRule{
		OrgID:        orgID,
		NamespaceUID: namespaceUID,
		Title:        title,
		Data:         []models.AlertQuery{queryNode},
		Condition:    "A",
		NoDataState:  noDataState,
		ExecErrState: execErrState,
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
		IsPaused:     false,
		For:          forInterval,
		RuleGroup:    group,
	}

	if rule.Record != "" {
		result.Record = &models.Record{
			From:   "A",
			Metric: rule.Record,
		}
	}

	return result, nil
}

func parseDurationOrDefault(durationStr string, defaultVal time.Duration) (time.Duration, error) {
	if durationStr == "" {
		return defaultVal, nil
	}
	duration, err := gtime.ParseDuration(durationStr)
	if err != nil {
		return 0, err
	}
	return duration, nil
}

func createAlertQueryNode(datasourceUID, expr string, fromTimeRange time.Duration) (models.AlertQuery, error) {
	modelData := map[string]interface{}{
		"datasource": map[string]interface{}{
			"type": "prometheus",
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

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return models.AlertQuery{}, err
	}

	return models.AlertQuery{
		DatasourceUID: datasourceUID,
		Model:         modelJSON,
		RefID:         "A",
		RelativeTimeRange: models.RelativeTimeRange{
			From: models.Duration(fromTimeRange),
			To:   0,
		},
	}, nil
}
