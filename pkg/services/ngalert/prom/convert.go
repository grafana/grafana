package prom

import (
	"fmt"
	"maps"
	"time"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

const (
	// ruleUIDLabel is a special label that can be used to set a custom UID for a Prometheus
	// alert rule when converting it to a Grafana alert rule. If this label is not present,
	// a stable UID will be generated automatically based on the rule's data.
	ruleUIDLabel = "__grafana_alert_rule_uid__"

	queryRefID          = "query"
	prometheusMathRefID = "prometheus_math"
	thresholdRefID      = "threshold"
)

var (
	ErrInvalidDatasourceType = errutil.ValidationFailed(
		"alerting.invalidDatasourceType",
		errutil.WithPublicMessage("Datasource type must be Prometheus or Loki to import rules."),
	)
	ErrInvalidTargetDatasourceType = errutil.ValidationFailed(
		"alerting.invalidTargetDatasourceType",
		errutil.WithPublicMessage("Target datasource type must be Prometheus for recording rules."),
	)
)

// Config defines the configuration options for the Prometheus to Grafana rules converter.
type Config struct {
	// DataSourceUID is the UID of the datasource the rules are querying.
	DatasourceUID  string
	DatasourceType string
	// TargetDatasourceUID is the UID of the datasource the recording rules are writing to.
	// If not set, it defaults to DataSourceUID.
	TargetDatasourceUID  string
	TargetDatasourceType string
	// DefaultInterval is the default interval for rules in the groups that
	// don't have Interval set.
	DefaultInterval  time.Duration
	FromTimeRange    *time.Duration
	EvaluationOffset *time.Duration
	ExecErrState     models.ExecutionErrorState
	NoDataState      models.NoDataState
	// KeepOriginalRuleDefinition indicates whether the original Prometheus rule definition
	// if saved to the alert rule metadata. If not, then it will not be possible to convert
	// the alert rule back to Prometheus format.
	KeepOriginalRuleDefinition *bool
	RecordingRules             RulesConfig
	AlertRules                 RulesConfig
}

// RulesConfig contains configuration that applies to either recording or alerting rules.
type RulesConfig struct {
	IsPaused bool
}

var (
	defaultTimeRange        = 600 * time.Second
	defaultEvaluationOffset = 0 * time.Minute

	defaultConfig = Config{
		FromTimeRange:              &defaultTimeRange,
		EvaluationOffset:           &defaultEvaluationOffset,
		ExecErrState:               models.OkErrState,
		NoDataState:                models.OK,
		KeepOriginalRuleDefinition: util.Pointer(true),
	}
)

type Converter struct {
	cfg Config
}

// NewConverter creates a new Converter instance with the provided configuration.
// It validates the configuration and returns an error if any required fields are missing
// or if the configuration is invalid.
func NewConverter(cfg Config) (*Converter, error) {
	if cfg.DatasourceUID == "" {
		return nil, fmt.Errorf("datasource UID is required")
	}
	if cfg.TargetDatasourceUID == "" {
		cfg.TargetDatasourceUID = cfg.DatasourceUID
		cfg.TargetDatasourceType = cfg.DatasourceType
	}
	if cfg.DatasourceType == "" {
		return nil, fmt.Errorf("datasource type is required")
	}
	if cfg.DefaultInterval == 0 {
		return nil, fmt.Errorf("default evaluation interval is required")
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
	if cfg.KeepOriginalRuleDefinition == nil {
		cfg.KeepOriginalRuleDefinition = defaultConfig.KeepOriginalRuleDefinition
	}
	if cfg.DatasourceType != datasources.DS_PROMETHEUS && cfg.DatasourceType != datasources.DS_LOKI {
		return nil, ErrInvalidDatasourceType.Errorf("invalid datasource type: %s, must be prometheus or loki", cfg.DatasourceType)
	}

	return &Converter{
		cfg: cfg,
	}, nil
}

// PrometheusRulesToGrafana converts a Prometheus rule group into Grafana Alerting rule group.
func (p *Converter) PrometheusRulesToGrafana(orgID int64, namespaceUID string, group PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	if err := group.Validate(); err != nil {
		return nil, err
	}

	grafanaGroup, err := p.convertRuleGroup(orgID, namespaceUID, group)
	if err != nil {
		return nil, fmt.Errorf("failed to convert rule group '%s': %w", group.Name, err)
	}

	return grafanaGroup, nil
}

func (p *Converter) convertRuleGroup(orgID int64, namespaceUID string, promGroup PrometheusRuleGroup) (*models.AlertRuleGroup, error) {
	rules := make([]models.AlertRule, 0, len(promGroup.Rules))

	interval := time.Duration(promGroup.Interval)
	if interval == 0 {
		interval = p.cfg.DefaultInterval
	}

	for i, rule := range promGroup.Rules {
		gr, err := p.convertRule(orgID, namespaceUID, promGroup, rule)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Prometheus rule '%s' to Grafana rule: %w", rule.Alert, err)
		}
		gr.RuleGroupIndex = i + 1
		gr.IntervalSeconds = int64(interval.Seconds())

		uid, err := getUID(orgID, namespaceUID, promGroup.Name, i, rule)
		if err != nil {
			return nil, fmt.Errorf("failed to generate UID for rule '%s': %w", gr.Title, err)
		}
		gr.UID = uid

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

// getUID returns a UID for a Prometheus rule.
// If the rule has a special label its value is used.
// Otherwise, a stable UUID is generated by using a hash of the rule's data.
func getUID(orgID int64, namespaceUID string, group string, position int, promRule PrometheusRule) (string, error) {
	if uid, ok := promRule.Labels[ruleUIDLabel]; ok {
		if err := util.ValidateUID(uid); err != nil {
			return "", fmt.Errorf("invalid UID label value: %s; %w", uid, err)
		}
		return uid, nil
	}

	// Generate stable UUID based on the orgID, namespace, group and position.
	uidData := fmt.Sprintf("%d|%s|%s|%d", orgID, namespaceUID, group, position)
	u := uuid.NewSHA1(uuid.NameSpaceOID, []byte(uidData))

	return u.String(), nil
}

func (p *Converter) convertRule(orgID int64, namespaceUID string, promGroup PrometheusRuleGroup, rule PrometheusRule) (models.AlertRule, error) {
	var forInterval time.Duration
	if rule.For != nil {
		forInterval = time.Duration(*rule.For)
	}

	var keepFiringFor time.Duration
	if rule.KeepFiringFor != nil {
		keepFiringFor = time.Duration(*rule.KeepFiringFor)
	}

	var query []models.AlertQuery
	var title string
	var isPaused bool
	var record *models.Record
	var err error

	isRecordingRule := rule.Record != ""
	query, err = p.createQuery(rule.Expr, isRecordingRule, promGroup)
	if err != nil {
		return models.AlertRule{}, err
	}

	if isRecordingRule {
		if p.cfg.TargetDatasourceType != datasources.DS_PROMETHEUS {
			return models.AlertRule{}, ErrInvalidTargetDatasourceType.Errorf("invalid target datasource type: %s, must be prometheus", p.cfg.TargetDatasourceType)
		}

		record = &models.Record{
			From:                queryRefID,
			Metric:              rule.Record,
			TargetDatasourceUID: p.cfg.TargetDatasourceUID,
		}

		isPaused = p.cfg.RecordingRules.IsPaused
		title = rule.Record
	} else {
		isPaused = p.cfg.AlertRules.IsPaused
		title = rule.Alert
	}

	labels := make(map[string]string, len(rule.Labels)+len(promGroup.Labels))
	maps.Copy(labels, promGroup.Labels)
	maps.Copy(labels, rule.Labels)

	originalRuleDefinition, err := yaml.Marshal(rule)
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("failed to marshal original rule definition: %w", err)
	}

	result := models.AlertRule{
		OrgID:         orgID,
		NamespaceUID:  namespaceUID,
		Title:         title,
		Data:          query,
		Condition:     query[len(query)-1].RefID,
		NoDataState:   p.cfg.NoDataState,
		ExecErrState:  p.cfg.ExecErrState,
		Annotations:   rule.Annotations,
		Labels:        labels,
		For:           forInterval,
		KeepFiringFor: keepFiringFor,
		RuleGroup:     promGroup.Name,
		IsPaused:      isPaused,
		Record:        record,

		// MissingSeriesEvalsToResolve is set to 1 to match the Prometheus behaviour.
		// Prometheus resolves alerts as soon as the series disappears.
		// By setting this value to 1 we ensure that the alert is resolved on the first evaluation
		// that doesn't have the series.
		MissingSeriesEvalsToResolve: util.Pointer(1),
	}

	if p.cfg.KeepOriginalRuleDefinition != nil && *p.cfg.KeepOriginalRuleDefinition {
		result.Metadata.PrometheusStyleRule = &models.PrometheusStyleRule{
			OriginalRuleDefinition: string(originalRuleDefinition),
		}
	}

	return result, nil
}

// createQuery constructs the alert query nodes for a given Prometheus rule expression.
// It returns a slice of AlertQuery that represent the evaluation steps for the rule.
//
// For recording rules it generates a single query node that
// executes the PromQL query in the configured datasource.
//
// For alerting rules, it generates three query nodes:
//  1. Query Node (query): Executes the PromQL query using the configured datasource.
//  2. Math Node (prometheus_math): Applies a math expression "is_number($query) || is_nan($query) || is_inf($query)".
//  3. Threshold Node (threshold): Gets the result from the math node and checks that it's greater than 0.
//
// This is needed to ensure that we keep the Prometheus behaviour, where any returned result
// is considered alerting, and only when the query returns no data is the alert treated as normal.
func (p *Converter) createQuery(expr string, isRecordingRule bool, promGroup PrometheusRuleGroup) ([]models.AlertQuery, error) {
	// If evaluation offset is set on the group level, use that, otherwise use the global evaluation offset.
	var evaluationOffset time.Duration
	if promGroup.QueryOffset != nil {
		evaluationOffset = time.Duration(*promGroup.QueryOffset)
	} else {
		evaluationOffset = *p.cfg.EvaluationOffset
	}

	queryNode, err := createQueryNode(p.cfg.DatasourceUID, p.cfg.DatasourceType, expr, *p.cfg.FromTimeRange, evaluationOffset)
	if err != nil {
		return nil, err
	}

	if isRecordingRule {
		return []models.AlertQuery{queryNode}, nil
	}

	mathNode, err := createMathNode()
	if err != nil {
		return nil, err
	}

	thresholdNode, err := createThresholdNode()
	if err != nil {
		return nil, err
	}

	return []models.AlertQuery{queryNode, mathNode, thresholdNode}, nil
}
