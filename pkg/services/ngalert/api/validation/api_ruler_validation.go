package validation

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	prommodels "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	. "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RuleLimits struct {
	// The default interval if not specified.
	DefaultRuleEvaluationInterval time.Duration
	// All intervals must be an integer multiple of this duration.
	BaseInterval time.Duration
}

func RuleLimitsFromConfig(cfg *setting.UnifiedAlertingSettings, toggles featuremgmt.FeatureToggles) RuleLimits {
	return RuleLimits{
		DefaultRuleEvaluationInterval: cfg.DefaultRuleEvaluationInterval,
		BaseInterval:                  cfg.BaseInterval,
	}
}

// ValidateRuleNode validates API model (definitions.PostableExtendedRuleNode) and converts it to models.AlertRule
func ValidateRuleNode(
	ruleNode *apimodels.PostableExtendedRuleNode,
	groupName string,
	interval time.Duration,
	orgId int64,
	namespaceUID string,
	limits RuleLimits) (*ngmodels.AlertRule, error) {
	intervalSeconds, err := ValidateInterval(interval, limits.BaseInterval)
	if err != nil {
		return nil, err
	}

	if ruleNode.GrafanaManagedAlert == nil {
		return nil, fmt.Errorf("not Grafana managed alert rule")
	}

	isRecordingRule := ruleNode.GrafanaManagedAlert.Record != nil
	// if UID is specified then we can accept partial model. Therefore, some validation can be skipped as it will be patched later
	canPatch := ruleNode.GrafanaManagedAlert.UID != ""

	if ruleNode.GrafanaManagedAlert.Title == "" && !canPatch {
		return nil, errors.New("alert rule title cannot be empty")
	}

	if len(ruleNode.GrafanaManagedAlert.Title) > store.AlertRuleMaxTitleLength {
		return nil, fmt.Errorf("alert rule title is too long. Max length is %d", store.AlertRuleMaxTitleLength)
	}

	queries := AlertQueriesFromApiAlertQueries(ruleNode.GrafanaManagedAlert.Data)

	newAlertRule := ngmodels.AlertRule{
		OrgID:                       orgId,
		Title:                       ruleNode.GrafanaManagedAlert.Title,
		Condition:                   ruleNode.GrafanaManagedAlert.Condition,
		Data:                        queries,
		UID:                         ruleNode.GrafanaManagedAlert.UID,
		IntervalSeconds:             intervalSeconds,
		NamespaceUID:                namespaceUID,
		RuleGroup:                   groupName,
		MissingSeriesEvalsToResolve: ruleNode.GrafanaManagedAlert.MissingSeriesEvalsToResolve,
	}

	if isRecordingRule {
		newAlertRule, err = validateRecordingRuleFields(ruleNode, newAlertRule, limits, canPatch)
	} else {
		newAlertRule, err = validateAlertingRuleFields(ruleNode, newAlertRule, canPatch)
	}
	if err != nil {
		return nil, err
	}

	if ruleNode.ApiRuleNode != nil {
		newAlertRule.Annotations = ruleNode.Annotations
		err = validateLabels(ruleNode.Labels)
		if err != nil {
			return nil, err
		}
		newAlertRule.Labels = ruleNode.Labels

		err = newAlertRule.SetDashboardAndPanelFromAnnotations()
		if err != nil {
			return nil, err
		}
	}
	return &newAlertRule, nil
}

// validateAlertingRuleFields validates only the fields on a rule that are specific to Alerting rules.
// it will load fields that pass validation onto newRule and return the result.
func validateAlertingRuleFields(in *apimodels.PostableExtendedRuleNode, newRule ngmodels.AlertRule, canPatch bool) (ngmodels.AlertRule, error) {
	var err error

	if in.GrafanaManagedAlert.Record != nil {
		return ngmodels.AlertRule{}, fmt.Errorf("%w: rule cannot be simultaneously an alerting and recording rule", ngmodels.ErrAlertRuleFailedValidation)
	}

	noDataState := ngmodels.NoData
	if in.GrafanaManagedAlert.NoDataState == "" && canPatch {
		noDataState = ""
	}
	if in.GrafanaManagedAlert.NoDataState != "" {
		noDataState, err = ngmodels.NoDataStateFromString(string(in.GrafanaManagedAlert.NoDataState))
		if err != nil {
			return ngmodels.AlertRule{}, err
		}
	}
	newRule.NoDataState = noDataState

	errorState := ngmodels.AlertingErrState
	if in.GrafanaManagedAlert.ExecErrState == "" && canPatch {
		errorState = ""
	}
	if in.GrafanaManagedAlert.ExecErrState != "" {
		errorState, err = ngmodels.ErrStateFromString(string(in.GrafanaManagedAlert.ExecErrState))
		if err != nil {
			return ngmodels.AlertRule{}, err
		}
	}
	newRule.ExecErrState = errorState

	err = ValidateCondition(in.GrafanaManagedAlert.Condition, in.GrafanaManagedAlert.Data, canPatch)
	if err != nil {
		return ngmodels.AlertRule{}, err
	}

	if in.GrafanaManagedAlert.NotificationSettings != nil {
		newRule.NotificationSettings, err = ValidateNotificationSettings(in.GrafanaManagedAlert.NotificationSettings)
		if err != nil {
			return ngmodels.AlertRule{}, err
		}
	}

	if in.GrafanaManagedAlert.Metadata != nil {
		newRule.Metadata.EditorSettings = ngmodels.EditorSettings{
			SimplifiedQueryAndExpressionsSection: in.GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection,
			SimplifiedNotificationsSection:       in.GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedNotificationsSection,
		}
	}

	newRule.MissingSeriesEvalsToResolve, err = validateMissingSeriesEvalsToResolve(in)
	if err != nil {
		return ngmodels.AlertRule{}, err
	}

	newRule.For, err = validateForInterval(in)
	if err != nil {
		return ngmodels.AlertRule{}, err
	}

	newRule.KeepFiringFor, err = validateKeepFiringForInterval(in)
	if err != nil {
		return ngmodels.AlertRule{}, err
	}

	return newRule, nil
}

// validateRecordingRuleFields validates only the fields on a rule that are specific to Recording rules.
// it will load fields that pass validation onto newRule and return the result.
func validateRecordingRuleFields(in *apimodels.PostableExtendedRuleNode, newRule ngmodels.AlertRule, limits RuleLimits, canPatch bool) (ngmodels.AlertRule, error) {
	err := ValidateCondition(in.GrafanaManagedAlert.Record.From, in.GrafanaManagedAlert.Data, canPatch)
	if err != nil {
		return ngmodels.AlertRule{}, fmt.Errorf("%w: %s", ngmodels.ErrAlertRuleFailedValidation, err.Error())
	}

	metricName := prommodels.LabelValue(in.GrafanaManagedAlert.Record.Metric)
	if !metricName.IsValid() {
		return ngmodels.AlertRule{}, fmt.Errorf("%w: %s", ngmodels.ErrAlertRuleFailedValidation, "metric name for recording rule must be a valid utf8 string")
	}
	if !prommodels.IsValidMetricName(metricName) {
		return ngmodels.AlertRule{}, fmt.Errorf("%w: %s", ngmodels.ErrAlertRuleFailedValidation, "metric name for recording rule must be a valid Prometheus metric name")
	}
	newRule.Record = ModelRecordFromApiRecord(in.GrafanaManagedAlert.Record)

	newRule.NoDataState = ""
	newRule.ExecErrState = ""
	newRule.Condition = ""
	newRule.For = 0
	newRule.KeepFiringFor = 0
	newRule.NotificationSettings = nil

	return newRule, nil
}

func validateLabels(l map[string]string) error {
	for key := range l {
		if _, ok := ngmodels.LabelsUserCannotSpecify[key]; ok {
			return fmt.Errorf("system reserved labels cannot be defined in the rule. Label %s is the reserved", key)
		}
	}
	return nil
}

func ValidateCondition(condition string, queries []apimodels.AlertQuery, canPatch bool) error {
	if canPatch {
		// Patch requests may leave both query and condition blank. If a request supplies one, it must supply the other.
		if len(queries) == 0 && condition == "" {
			return nil
		}
		if len(queries) == 0 && condition != "" {
			return fmt.Errorf("%w: query is not specified but condition is. You must specify both query and condition to update existing alert rule", ngmodels.ErrAlertRuleFailedValidation)
		}
		if len(queries) > 0 && condition == "" {
			return fmt.Errorf("%w: condition is not specified but query is. You must specify both query and condition to update existing alert rule", ngmodels.ErrAlertRuleFailedValidation)
		}
	}

	if condition == "" {
		return fmt.Errorf("%w: condition cannot be empty", ngmodels.ErrAlertRuleFailedValidation)
	}
	if len(queries) == 0 {
		return fmt.Errorf("%w: no queries or expressions are found", ngmodels.ErrAlertRuleFailedValidation)
	}

	refIDs := make(map[string]int, len(queries))
	for idx, query := range queries {
		if query.RefID == "" {
			return fmt.Errorf("%w: refID is not specified for data query/expression at index %d", ngmodels.ErrAlertRuleFailedValidation, idx)
		}
		if usedIdx, ok := refIDs[query.RefID]; ok {
			return fmt.Errorf("%w: refID '%s' is already used by query/expression at index %d", ngmodels.ErrAlertRuleFailedValidation, query.RefID, usedIdx)
		}
		refIDs[query.RefID] = idx
	}
	if _, ok := refIDs[condition]; !ok {
		ids := make([]string, 0, len(refIDs))
		for id := range refIDs {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		return fmt.Errorf("%w: condition %s does not exist, must be one of [%s]", ngmodels.ErrAlertRuleFailedValidation, condition, strings.Join(ids, ","))
	}
	return nil
}

func ValidateInterval(interval, baseInterval time.Duration) (int64, error) {
	intervalSeconds := int64(interval.Seconds())

	baseIntervalSeconds := int64(baseInterval.Seconds())

	if interval <= 0 {
		return 0, fmt.Errorf("rule evaluation interval must be positive duration that is multiple of the base interval %d seconds", baseIntervalSeconds)
	}

	if intervalSeconds%baseIntervalSeconds != 0 {
		return 0, fmt.Errorf("rule evaluation interval %d should be multiple of the base interval of %d seconds", int64(interval.Seconds()), baseIntervalSeconds)
	}

	return intervalSeconds, nil
}

// validateForInterval validates ApiRuleNode.For and converts it to time.Duration. If the field is not specified returns 0 if GrafanaManagedAlert.UID is empty and -1 if it is not.
func validateForInterval(ruleNode *apimodels.PostableExtendedRuleNode) (time.Duration, error) {
	if ruleNode.ApiRuleNode == nil || ruleNode.For == nil {
		if ruleNode.GrafanaManagedAlert.UID != "" {
			return -1, nil // will be patched later with the real value of the current version of the rule
		}
		return 0, nil // if it's a new rule, use the 0 as the default
	}
	duration := time.Duration(*ruleNode.For)
	if duration < 0 {
		return 0, fmt.Errorf("field `for` cannot be negative [%v]. 0 or any positive duration are allowed", *ruleNode.For)
	}
	return duration, nil
}

// validateKeepFiringForInterval validates ApiRuleNode.KeepFiringFor and converts it to time.Duration. If the field is not specified returns 0 if GrafanaManagedAlert.UID is empty and -1 if it is not.
func validateKeepFiringForInterval(ruleNode *apimodels.PostableExtendedRuleNode) (time.Duration, error) {
	if ruleNode.ApiRuleNode == nil || ruleNode.KeepFiringFor == nil {
		if ruleNode.GrafanaManagedAlert.UID != "" {
			return -1, nil // will be patched later with the real value of the current version of the rule
		}
		return 0, nil // if it's a new rule, use the 0 as the default
	}
	duration := time.Duration(*ruleNode.KeepFiringFor)
	if duration < 0 {
		return 0, fmt.Errorf("field `keep_firing_for` cannot be negative [%v]. only 0 or any positive value is allowed", *ruleNode.KeepFiringFor)
	}
	return duration, nil
}

// validateMissingSeriesEvalsToResolve validates MissingSeriesEvalsToResolve and converts it to *int.
// If the ruleNode.GrafanaManagedAlert.MissingSeriesEvalsToResolve is:
//   - == 0, returns nil (reset to default)
//   - == nil && UID == "", returns nil (new rule)
//   - == nil && UID != "", returns -1 (existing rule)
func validateMissingSeriesEvalsToResolve(ruleNode *apimodels.PostableExtendedRuleNode) (*int64, error) {
	if ruleNode.GrafanaManagedAlert.MissingSeriesEvalsToResolve == nil {
		if ruleNode.GrafanaManagedAlert.UID != "" {
			return util.Pointer[int64](-1), nil // will be patched later with the real value of the current version of the rule
		}
		return nil, nil // if it's a new rule, use nil as the default
	}

	v := ruleNode.GrafanaManagedAlert.MissingSeriesEvalsToResolve
	if *v == 0 {
		return nil, nil // allow to reset the value to default when 0 is sent
	} else if *v < 0 {
		return nil, fmt.Errorf("field `missing_series_evals_to_resolve` cannot be negative [%v]. 0 or any positive number are allowed", *v)
	}

	return v, nil
}

// ValidateRuleGroup validates API model (definitions.PostableRuleGroupConfig) and converts it to a collection of models.AlertRule.
// Returns a slice that contains all rules described by API model or error if either group specification or an alert definition is not valid.
// It also returns a map containing current existing alerts that don't contain the is_paused field in the body of the call.
func ValidateRuleGroup(
	ruleGroupConfig *apimodels.PostableRuleGroupConfig,
	orgId int64,
	namespaceUID string,
	limits RuleLimits) ([]*ngmodels.AlertRuleWithOptionals, error) {
	if ruleGroupConfig.Name == "" {
		return nil, errors.New("rule group name cannot be empty")
	}

	if len(ruleGroupConfig.Name) > store.AlertRuleMaxRuleGroupNameLength {
		return nil, fmt.Errorf("rule group name is too long. Max length is %d", store.AlertRuleMaxRuleGroupNameLength)
	}

	interval := time.Duration(ruleGroupConfig.Interval)
	if interval == 0 {
		// if group interval is 0 (undefined) then we automatically fall back to the default interval
		interval = limits.DefaultRuleEvaluationInterval
	}

	if interval < 0 || int64(interval.Seconds())%int64(limits.BaseInterval.Seconds()) != 0 {
		return nil, fmt.Errorf("rule evaluation interval (%d second) should be positive number that is multiple of the base interval of %d seconds", int64(interval.Seconds()), int64(limits.BaseInterval.Seconds()))
	}

	// TODO should we validate that interval is >= cfg.MinInterval? Currently, we allow to save but fix the specified interval if it is < cfg.MinInterval

	result := make([]*ngmodels.AlertRuleWithOptionals, 0, len(ruleGroupConfig.Rules))
	uids := make(map[string]int, cap(result))
	for idx := range ruleGroupConfig.Rules {
		rule, err := ValidateRuleNode(&ruleGroupConfig.Rules[idx], ruleGroupConfig.Name, interval, orgId, namespaceUID, limits)
		// TODO do not stop on the first failure but return all failures
		if err != nil {
			return nil, fmt.Errorf("invalid rule specification at index [%d]: %w", idx, err)
		}
		if rule.UID != "" {
			if existingIdx, ok := uids[rule.UID]; ok {
				return nil, fmt.Errorf("rule [%d] has UID %s that is already assigned to another rule at index %d", idx, rule.UID, existingIdx)
			}
			uids[rule.UID] = idx
		}

		var hasPause, isPaused, hasEditorSettings bool
		original := ruleGroupConfig.Rules[idx]
		if alert := original.GrafanaManagedAlert; alert != nil {
			if alert.IsPaused != nil {
				isPaused = *alert.IsPaused
				hasPause = true
			}
			if alert.Metadata != nil {
				hasEditorSettings = true
			}
		}

		ruleWithOptionals := ngmodels.AlertRuleWithOptionals{}
		rule.IsPaused = isPaused
		rule.RuleGroupIndex = idx + 1
		ruleWithOptionals.AlertRule = *rule
		ruleWithOptionals.HasPause = hasPause
		ruleWithOptionals.HasEditorSettings = hasEditorSettings

		result = append(result, &ruleWithOptionals)
	}
	return result, nil
}

func ValidateNotificationSettings(n *apimodels.AlertRuleNotificationSettings) ([]ngmodels.NotificationSettings, error) {
	s := ngmodels.NotificationSettings{
		Receiver:            n.Receiver,
		GroupBy:             n.GroupBy,
		GroupWait:           n.GroupWait,
		GroupInterval:       n.GroupInterval,
		RepeatInterval:      n.RepeatInterval,
		MuteTimeIntervals:   n.MuteTimeIntervals,
		ActiveTimeIntervals: n.ActiveTimeIntervals,
	}

	if err := s.Validate(); err != nil {
		return nil, fmt.Errorf("invalid notification settings: %w", err)
	}
	return []ngmodels.NotificationSettings{
		s,
	}, nil
}
