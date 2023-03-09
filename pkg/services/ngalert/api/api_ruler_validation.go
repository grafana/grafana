package api

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

// validateRuleNode validates API model (definitions.PostableExtendedRuleNode) and converts it to models.AlertRule
func validateRuleNode(
	ruleNode *apimodels.PostableExtendedRuleNode,
	groupName string,
	interval time.Duration,
	orgId int64,
	namespace *folder.Folder,
	conditionValidator func(ngmodels.Condition) error,
	cfg *setting.UnifiedAlertingSettings) (*ngmodels.AlertRule, error) {
	intervalSeconds, err := validateInterval(cfg, interval)
	if err != nil {
		return nil, err
	}

	if ruleNode.GrafanaManagedAlert == nil {
		return nil, fmt.Errorf("not Grafana managed alert rule")
	}

	// if UID is specified then we can accept partial model. Therefore, some validation can be skipped as it will be patched later
	canPatch := ruleNode.GrafanaManagedAlert.UID != ""

	if ruleNode.GrafanaManagedAlert.Title == "" && !canPatch {
		return nil, errors.New("alert rule title cannot be empty")
	}

	if len(ruleNode.GrafanaManagedAlert.Title) > store.AlertRuleMaxTitleLength {
		return nil, fmt.Errorf("alert rule title is too long. Max length is %d", store.AlertRuleMaxTitleLength)
	}

	noDataState := ngmodels.NoData
	if ruleNode.GrafanaManagedAlert.NoDataState == "" && canPatch {
		noDataState = ""
	}

	if ruleNode.GrafanaManagedAlert.NoDataState != "" {
		noDataState, err = ngmodels.NoDataStateFromString(string(ruleNode.GrafanaManagedAlert.NoDataState))
		if err != nil {
			return nil, err
		}
	}

	errorState := ngmodels.AlertingErrState

	if ruleNode.GrafanaManagedAlert.ExecErrState == "" && canPatch {
		errorState = ""
	}

	if ruleNode.GrafanaManagedAlert.ExecErrState != "" {
		errorState, err = ngmodels.ErrStateFromString(string(ruleNode.GrafanaManagedAlert.ExecErrState))
		if err != nil {
			return nil, err
		}
	}

	if len(ruleNode.GrafanaManagedAlert.Data) == 0 {
		if canPatch {
			if ruleNode.GrafanaManagedAlert.Condition != "" {
				return nil, fmt.Errorf("%w: query is not specified by condition is. You must specify both query and condition to update existing alert rule", ngmodels.ErrAlertRuleFailedValidation)
			}
		} else {
			return nil, fmt.Errorf("%w: no queries or expressions are found", ngmodels.ErrAlertRuleFailedValidation)
		}
	}

	queries := AlertQueriesFromApiAlertQueries(ruleNode.GrafanaManagedAlert.Data)
	if len(queries) != 0 {
		cond := ngmodels.Condition{
			Condition: ruleNode.GrafanaManagedAlert.Condition,
			Data:      queries,
		}
		if err = conditionValidator(cond); err != nil {
			return nil, fmt.Errorf("failed to validate condition of alert rule %s: %w", ruleNode.GrafanaManagedAlert.Title, err)
		}
	}

	newAlertRule := ngmodels.AlertRule{
		OrgID:           orgId,
		Title:           ruleNode.GrafanaManagedAlert.Title,
		Condition:       ruleNode.GrafanaManagedAlert.Condition,
		Data:            queries,
		UID:             ruleNode.GrafanaManagedAlert.UID,
		IntervalSeconds: intervalSeconds,
		NamespaceUID:    namespace.UID,
		RuleGroup:       groupName,
		NoDataState:     noDataState,
		ExecErrState:    errorState,
	}

	newAlertRule.For, err = validateForInterval(ruleNode)
	if err != nil {
		return nil, err
	}

	newAlertRule.ForError, err = validateForErrorInterval(ruleNode)
	if err != nil {
		return nil, err
	}

	if ruleNode.ApiRuleNode != nil {
		newAlertRule.Annotations = ruleNode.ApiRuleNode.Annotations
		newAlertRule.Labels = ruleNode.ApiRuleNode.Labels

		err = newAlertRule.SetDashboardAndPanelFromAnnotations()
		if err != nil {
			return nil, err
		}
	}
	return &newAlertRule, nil
}

func validateInterval(cfg *setting.UnifiedAlertingSettings, interval time.Duration) (int64, error) {
	intervalSeconds := int64(interval.Seconds())

	baseIntervalSeconds := int64(cfg.BaseInterval.Seconds())

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
	if ruleNode.ApiRuleNode == nil || ruleNode.ApiRuleNode.For == nil {
		if ruleNode.GrafanaManagedAlert.UID != "" {
			return -1, nil // will be patched later with the real value of the current version of the rule
		}
		return 0, nil // if it's a new rule, use the 0 as the default
	}
	duration := time.Duration(*ruleNode.ApiRuleNode.For)
	if duration < 0 {
		return 0, fmt.Errorf("field `for` cannot be negative [%v]. 0 or any positive duration are allowed", *ruleNode.ApiRuleNode.For)
	}
	return duration, nil
}

// validateForErrorInterval validates GrafanaManagedAlert.ForError and converts it to time.Duration.
// If the field is not specified returns 0 if GrafanaManagedAlert.UID is empty and -1 if it is not.
func validateForErrorInterval(ruleNode *apimodels.PostableExtendedRuleNode) (time.Duration, error) {
	if ruleNode.GrafanaManagedAlert == nil || ruleNode.GrafanaManagedAlert.ForError == nil {
		if ruleNode.GrafanaManagedAlert.UID != "" {
			return -1, nil // will be patched later with the real value of the current version of the rule
		}
		return 0, nil // if it's a new rule, use the 0 as the default
	}
	duration := time.Duration(*ruleNode.GrafanaManagedAlert.ForError)
	if duration < 0 {
		return 0, fmt.Errorf("field `forError` cannot be negative [%v]. 0 or any positive duration are allowed", *ruleNode.GrafanaManagedAlert.ForError)
	}
	return duration, nil
}

// validateRuleGroup validates API model (definitions.PostableRuleGroupConfig) and converts it to a collection of models.AlertRule.
// Returns a slice that contains all rules described by API model or error if either group specification or an alert definition is not valid.
// It also returns a map containing current existing alerts that don't contain the is_paused field in the body of the call.
func validateRuleGroup(
	ruleGroupConfig *apimodels.PostableRuleGroupConfig,
	orgId int64,
	namespace *folder.Folder,
	conditionValidator func(ngmodels.Condition) error,
	cfg *setting.UnifiedAlertingSettings) ([]*ngmodels.AlertRuleWithOptionals, error) {
	if ruleGroupConfig.Name == "" {
		return nil, errors.New("rule group name cannot be empty")
	}

	if len(ruleGroupConfig.Name) > store.AlertRuleMaxRuleGroupNameLength {
		return nil, fmt.Errorf("rule group name is too long. Max length is %d", store.AlertRuleMaxRuleGroupNameLength)
	}

	interval := time.Duration(ruleGroupConfig.Interval)
	if interval == 0 {
		// if group interval is 0 (undefined) then we automatically fall back to the default interval
		interval = cfg.DefaultRuleEvaluationInterval
	}

	if interval < 0 || int64(interval.Seconds())%int64(cfg.BaseInterval.Seconds()) != 0 {
		return nil, fmt.Errorf("rule evaluation interval (%d second) should be positive number that is multiple of the base interval of %d seconds", int64(interval.Seconds()), int64(cfg.BaseInterval.Seconds()))
	}

	// TODO should we validate that interval is >= cfg.MinInterval? Currently, we allow to save but fix the specified interval if it is < cfg.MinInterval

	result := make([]*ngmodels.AlertRuleWithOptionals, 0, len(ruleGroupConfig.Rules))
	uids := make(map[string]int, cap(result))
	for idx := range ruleGroupConfig.Rules {
		rule, err := validateRuleNode(&ruleGroupConfig.Rules[idx], ruleGroupConfig.Name, interval, orgId, namespace, conditionValidator, cfg)
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

		var hasPause, isPaused bool
		original := ruleGroupConfig.Rules[idx]
		if alert := original.GrafanaManagedAlert; alert != nil {
			if alert.IsPaused != nil {
				isPaused = *alert.IsPaused
				hasPause = true
			}
		}

		ruleWithOptionals := ngmodels.AlertRuleWithOptionals{}
		rule.IsPaused = isPaused
		rule.RuleGroupIndex = idx + 1
		ruleWithOptionals.AlertRule = *rule
		ruleWithOptionals.HasPause = hasPause

		result = append(result, &ruleWithOptionals)
	}
	return result, nil
}
