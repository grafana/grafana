package prom

import (
	"encoding/json"
	"fmt"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Config struct {
	DatasourceUID    string
	DatasourceType   string
	FromTimeRange    *time.Duration
	EvaluationOffset *time.Duration
	ExecErrState     models.ExecutionErrorState
	NoDataState      models.NoDataState
	RecordingRules   RulesConfig
	AlertRules       RulesConfig
}

type RulesConfig struct {
	IsPaused bool
}

var (
	defaultTimeRange        = 600 * time.Second
	defaultEvaluationOffset = 0 * time.Minute

	defaultConfig = Config{
		FromTimeRange:    &defaultTimeRange,
		EvaluationOffset: &defaultEvaluationOffset,
		ExecErrState:     models.ErrorErrState,
		NoDataState:      models.NoData,
	}
)

type Converter struct {
	cfg Config
}

func NewConverter(cfg Config) (*Converter, error) {
	if cfg.DatasourceUID == "" {
		return nil, fmt.Errorf("datasource UID is required")
	}
	if cfg.DatasourceType == "" {
		return nil, fmt.Errorf("datasource type is required")
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

	if cfg.DatasourceType != datasources.DS_PROMETHEUS && cfg.DatasourceType != datasources.DS_LOKI {
		return nil, fmt.Errorf("invalid datasource type: %s", cfg.DatasourceType)
	}

	return &Converter{
		cfg: cfg,
	}, nil
}

// PrometheusRulesToGrafana converts a Prometheus rule group into Grafana Alerting rule group.
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

func validatePrometheusRule(rule PrometheusRule) error {
	if rule.KeepFiringFor != nil {
		return fmt.Errorf("keep_firing_for is not supported")
	}

	return nil
}

func (p *Converter) convertRuleGroup(orgID int64, namespaceUID string, promGroup PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	uniqueNames := map[string]int{}
	rules := make([]models.AlertRule, 0, len(promGroup.Rules))
	interval := time.Duration(promGroup.Interval)
	for i, rule := range promGroup.Rules {
		gr, err := p.convertRule(orgID, namespaceUID, promGroup.Name, rule)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Prometheus rule '%s' to Grafana rule: %w", rule.Alert, err)
		}
		gr.RuleGroupIndex = i + 1
		gr.IntervalSeconds = int64(interval.Seconds())

		// Check rule title uniqueness within the group.
		uniqueNames[gr.Title]++
		if val := uniqueNames[gr.Title]; val > 1 {
			gr.Title = fmt.Sprintf("%s (%d)", gr.Title, val)
		}

		rules = append(rules, gr)
	}

	result := &models.AlertRuleGroup{
		FolderUID: namespaceUID,
		Interval:  int64(interval.Seconds()),
		Rules:     rules,
		Title:     promGroup.Name,
	}

	return result, nil
}

func (p *Converter) convertRule(orgID int64, namespaceUID, group string, rule PrometheusRule) (models.AlertRule, error) {
	var forInterval time.Duration
	if rule.For != nil {
		forInterval = time.Duration(*rule.For)
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

	originalRuleDefinition, err := yaml.Marshal(rule)
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to marshal original rule definition: %w", err)
	}

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
			PrometheusStyleRule: &models.PrometheusStyleRule{
				OriginalRuleDefinition: string(originalRuleDefinition),
			},
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

func createAlertQueryNode(datasourceUID, datasourceType, expr string, fromTimeRange, evaluationOffset time.Duration) (models.AlertQuery, error) {
	modelData := map[string]interface{}{
		"datasource": map[string]interface{}{
			"type": datasourceType,
			"uid":  datasourceUID,
		},
		"expr":    expr,
		"instant": true,
		"range":   false,
		"refId":   "A",
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
