package api

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/models"
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
	namespace *models.Folder,
	conditionValidator func(ngmodels.Condition) error,
	cfg *setting.UnifiedAlertingSettings) (*ngmodels.AlertRule, error) {
	intervalSeconds := int64(interval.Seconds())

	baseIntervalSeconds := int64(cfg.BaseInterval.Seconds())

	if interval <= 0 {
		return nil, fmt.Errorf("rule evaluation interval must be positive duration that is multiple of the base interval %d seconds", baseIntervalSeconds)
	}

	if intervalSeconds%baseIntervalSeconds != 0 {
		return nil, fmt.Errorf("rule evaluation interval %d should be multiple of the base interval of %d seconds", int64(interval.Seconds()), baseIntervalSeconds)
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
		var err error
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
		var err error
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

	if len(ruleNode.GrafanaManagedAlert.Data) != 0 {
		cond := ngmodels.Condition{
			Condition: ruleNode.GrafanaManagedAlert.Condition,
			OrgID:     orgId,
			Data:      ruleNode.GrafanaManagedAlert.Data,
		}
		if err := conditionValidator(cond); err != nil {
			return nil, fmt.Errorf("failed to validate condition of alert rule %s: %w", ruleNode.GrafanaManagedAlert.Title, err)
		}
	}

	newAlertRule := ngmodels.AlertRule{
		OrgID:           orgId,
		Title:           ruleNode.GrafanaManagedAlert.Title,
		Condition:       ruleNode.GrafanaManagedAlert.Condition,
		Data:            ruleNode.GrafanaManagedAlert.Data,
		UID:             ruleNode.GrafanaManagedAlert.UID,
		IntervalSeconds: intervalSeconds,
		NamespaceUID:    namespace.Uid,
		RuleGroup:       groupName,
		NoDataState:     noDataState,
		ExecErrState:    errorState,
	}

	if ruleNode.ApiRuleNode != nil {
		newAlertRule.For = time.Duration(ruleNode.ApiRuleNode.For)
		newAlertRule.Annotations = ruleNode.ApiRuleNode.Annotations
		newAlertRule.Labels = ruleNode.ApiRuleNode.Labels

		dashUID := ruleNode.ApiRuleNode.Annotations[ngmodels.DashboardUIDAnnotation]
		panelID := ruleNode.ApiRuleNode.Annotations[ngmodels.PanelIDAnnotation]

		if dashUID != "" && panelID == "" || dashUID == "" && panelID != "" {
			return nil, fmt.Errorf("both annotations %s and %s must be specified", ngmodels.DashboardUIDAnnotation, ngmodels.PanelIDAnnotation)
		}

		if dashUID != "" {
			panelIDValue, err := strconv.ParseInt(panelID, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("annotation %s must be a valid integer Panel ID", ngmodels.PanelIDAnnotation)
			}
			newAlertRule.DashboardUID = &dashUID
			newAlertRule.PanelID = &panelIDValue
		}
	}

	return &newAlertRule, nil
}

// validateRuleGroup validates API model (definitions.PostableRuleGroupConfig) and converts it to a collection of models.AlertRule.
// Returns a slice that contains all rules described by API model or error if either group specification or an alert definition is not valid.
func validateRuleGroup(
	ruleGroupConfig *apimodels.PostableRuleGroupConfig,
	orgId int64,
	namespace *models.Folder,
	conditionValidator func(ngmodels.Condition) error,
	cfg *setting.UnifiedAlertingSettings) ([]*ngmodels.AlertRule, error) {
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

	result := make([]*ngmodels.AlertRule, 0, len(ruleGroupConfig.Rules))
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
		result = append(result, rule)
	}
	return result, nil
}
