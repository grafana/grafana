package provisioning

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleService struct {
	defaultIntervalSeconds int64
	baseIntervalSeconds    int64
	ruleStore              RuleStore
	provenanceStore        ProvisioningStore
	dashboardService       dashboards.DashboardService
	quotas                 QuotaChecker
	xact                   TransactionManager
	log                    log.Logger
}

func NewAlertRuleService(ruleStore RuleStore,
	provenanceStore ProvisioningStore,
	dashboardService dashboards.DashboardService,
	quotas QuotaChecker,
	xact TransactionManager,
	defaultIntervalSeconds int64,
	baseIntervalSeconds int64,
	log log.Logger) *AlertRuleService {
	return &AlertRuleService{
		defaultIntervalSeconds: defaultIntervalSeconds,
		baseIntervalSeconds:    baseIntervalSeconds,
		ruleStore:              ruleStore,
		provenanceStore:        provenanceStore,
		dashboardService:       dashboardService,
		quotas:                 quotas,
		xact:                   xact,
		log:                    log,
	}
}

func (service *AlertRuleService) GetAlertRules(ctx context.Context, orgID int64) ([]*models.AlertRule, error) {
	q := models.ListAlertRulesQuery{
		OrgID: orgID,
	}
	rules, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return nil, err
	}
	// TODO: GET provenance
	return rules, nil
}

func (service *AlertRuleService) GetAlertRule(ctx context.Context, orgID int64, ruleUID string) (models.AlertRule, models.Provenance, error) {
	query := &models.GetAlertRuleByUIDQuery{
		OrgID: orgID,
		UID:   ruleUID,
	}
	rules, err := service.ruleStore.GetAlertRuleByUID(ctx, query)
	if err != nil {
		return models.AlertRule{}, models.ProvenanceNone, err
	}
	provenance, err := service.provenanceStore.GetProvenance(ctx, rules, orgID)
	if err != nil {
		return models.AlertRule{}, models.ProvenanceNone, err
	}
	return *rules, provenance, nil
}

type AlertRuleWithFolderTitle struct {
	AlertRule   models.AlertRule
	FolderTitle string
}

// GetAlertRuleWithFolderTitle returns a single alert rule with its folder title.
func (service *AlertRuleService) GetAlertRuleWithFolderTitle(ctx context.Context, orgID int64, ruleUID string) (AlertRuleWithFolderTitle, error) {
	query := &models.GetAlertRuleByUIDQuery{
		OrgID: orgID,
		UID:   ruleUID,
	}
	rule, err := service.ruleStore.GetAlertRuleByUID(ctx, query)
	if err != nil {
		return AlertRuleWithFolderTitle{}, err
	}

	dq := dashboards.GetDashboardQuery{
		OrgID: orgID,
		UID:   rule.NamespaceUID,
	}

	dash, err := service.dashboardService.GetDashboard(ctx, &dq)
	if err != nil {
		return AlertRuleWithFolderTitle{}, err
	}

	return AlertRuleWithFolderTitle{
		AlertRule:   *rule,
		FolderTitle: dash.Title,
	}, nil
}

// CreateAlertRule creates a new alert rule. This function will ignore any
// interval that is set in the rule struct and use the already existing group
// interval or the default one.
func (service *AlertRuleService) CreateAlertRule(ctx context.Context, rule models.AlertRule, provenance models.Provenance, userID int64) (models.AlertRule, error) {
	if rule.UID == "" {
		rule.UID = util.GenerateShortUID()
	}
	interval, err := service.ruleStore.GetRuleGroupInterval(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup)
	// if the alert group does not exists we just use the default interval
	if err != nil && errors.Is(err, store.ErrAlertRuleGroupNotFound) {
		interval = service.defaultIntervalSeconds
	} else if err != nil {
		return models.AlertRule{}, err
	}
	rule.IntervalSeconds = interval
	err = rule.SetDashboardAndPanelFromAnnotations()
	if err != nil {
		return models.AlertRule{}, err
	}
	rule.Updated = time.Now()
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		ids, err := service.ruleStore.InsertAlertRules(ctx, []models.AlertRule{
			rule,
		})
		if err != nil {
			return err
		}
		if id, ok := ids[rule.UID]; ok {
			rule.ID = id
		} else {
			return errors.New("couldn't find newly created id")
		}

		if err = service.checkLimitsTransactionCtx(ctx, rule.OrgID, userID); err != nil {
			return err
		}

		return service.provenanceStore.SetProvenance(ctx, &rule, rule.OrgID, provenance)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, nil
}

func (service *AlertRuleService) GetRuleGroup(ctx context.Context, orgID int64, namespaceUID, group string) (models.AlertRuleGroup, error) {
	q := models.ListAlertRulesQuery{
		OrgID:         orgID,
		NamespaceUIDs: []string{namespaceUID},
		RuleGroup:     group,
	}
	ruleList, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return models.AlertRuleGroup{}, err
	}
	if len(ruleList) == 0 {
		return models.AlertRuleGroup{}, store.ErrAlertRuleGroupNotFound
	}
	res := models.AlertRuleGroup{
		Title:     ruleList[0].RuleGroup,
		FolderUID: ruleList[0].NamespaceUID,
		Interval:  ruleList[0].IntervalSeconds,
		Rules:     []models.AlertRule{},
	}
	for _, r := range ruleList {
		if r != nil {
			res.Rules = append(res.Rules, *r)
		}
	}
	return res, nil
}

// UpdateRuleGroup will update the interval for all rules in the group.
func (service *AlertRuleService) UpdateRuleGroup(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string, intervalSeconds int64) error {
	if err := models.ValidateRuleGroupInterval(intervalSeconds, service.baseIntervalSeconds); err != nil {
		return err
	}
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		query := &models.ListAlertRulesQuery{
			OrgID:         orgID,
			NamespaceUIDs: []string{namespaceUID},
			RuleGroup:     ruleGroup,
		}
		ruleList, err := service.ruleStore.ListAlertRules(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to list alert rules: %w", err)
		}
		updateRules := make([]models.UpdateRule, 0, len(ruleList))
		for _, rule := range ruleList {
			if rule.IntervalSeconds == intervalSeconds {
				continue
			}
			newRule := *rule
			newRule.IntervalSeconds = intervalSeconds
			updateRules = append(updateRules, models.UpdateRule{
				Existing: rule,
				New:      newRule,
			})
		}
		return service.ruleStore.UpdateAlertRules(ctx, updateRules)
	})
}

func (service *AlertRuleService) ReplaceRuleGroup(ctx context.Context, orgID int64, group models.AlertRuleGroup, userID int64, provenance models.Provenance) error {
	if err := models.ValidateRuleGroupInterval(group.Interval, service.baseIntervalSeconds); err != nil {
		return err
	}

	// If the provided request did not provide the rules list at all, treat it as though it does not wish to change rules.
	// This is done for backwards compatibility. Requests which specify only the interval must update only the interval.
	if group.Rules == nil {
		listRulesQuery := models.ListAlertRulesQuery{
			OrgID:         orgID,
			NamespaceUIDs: []string{group.FolderUID},
			RuleGroup:     group.Title,
		}
		ruleList, err := service.ruleStore.ListAlertRules(ctx, &listRulesQuery)
		if err != nil {
			return fmt.Errorf("failed to list alert rules: %w", err)
		}
		group.Rules = make([]models.AlertRule, 0, len(ruleList))
		for _, r := range ruleList {
			if r != nil {
				group.Rules = append(group.Rules, *r)
			}
		}
	}

	key := models.AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: group.FolderUID,
		RuleGroup:    group.Title,
	}
	rules := make([]*models.AlertRuleWithOptionals, len(group.Rules))
	group = *syncGroupRuleFields(&group, orgID)
	for i := range group.Rules {
		if err := group.Rules[i].SetDashboardAndPanelFromAnnotations(); err != nil {
			return err
		}
		rules = append(rules, &models.AlertRuleWithOptionals{AlertRule: group.Rules[i], HasPause: true})
	}
	delta, err := store.CalculateChanges(ctx, service.ruleStore, key, rules)
	if err != nil {
		return fmt.Errorf("failed to calculate diff for alert rules: %w", err)
	}

	// Refresh all calculated fields across all rules.
	delta = store.UpdateCalculatedRuleFields(delta)

	if len(delta.New) == 0 && len(delta.Update) == 0 && len(delta.Delete) == 0 {
		return nil
	}

	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		uids, err := service.ruleStore.InsertAlertRules(ctx, withoutNilAlertRules(delta.New))
		if err != nil {
			return fmt.Errorf("failed to insert alert rules: %w", err)
		}
		for uid := range uids {
			if err := service.provenanceStore.SetProvenance(ctx, &models.AlertRule{UID: uid}, orgID, provenance); err != nil {
				return err
			}
		}

		updates := make([]models.UpdateRule, 0, len(delta.Update))
		for _, update := range delta.Update {
			// check that provenance is not changed in a invalid way
			storedProvenance, err := service.provenanceStore.GetProvenance(ctx, update.New, orgID)
			if err != nil {
				return err
			}
			if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
				return fmt.Errorf("cannot update with provided provenance '%s', needs '%s'", provenance, storedProvenance)
			}
			updates = append(updates, models.UpdateRule{
				Existing: update.Existing,
				New:      *update.New,
			})
		}
		if err = service.ruleStore.UpdateAlertRules(ctx, updates); err != nil {
			return fmt.Errorf("failed to update alert rules: %w", err)
		}
		for _, update := range delta.Update {
			if err := service.provenanceStore.SetProvenance(ctx, update.New, orgID, provenance); err != nil {
				return err
			}
		}

		for _, delete := range delta.Delete {
			// check that provenance is not changed in a invalid way
			storedProvenance, err := service.provenanceStore.GetProvenance(ctx, delete, orgID)
			if err != nil {
				return err
			}
			if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
				return fmt.Errorf("cannot update with provided provenance '%s', needs '%s'", provenance, storedProvenance)
			}
		}
		if err := service.deleteRules(ctx, orgID, delta.Delete...); err != nil {
			return err
		}

		if err = service.checkLimitsTransactionCtx(ctx, orgID, userID); err != nil {
			return err
		}

		return nil
	})
}

// CreateAlertRule creates a new alert rule. This function will ignore any
// interval that is set in the rule struct and fetch the current group interval
// from database.
func (service *AlertRuleService) UpdateAlertRule(ctx context.Context, rule models.AlertRule, provenance models.Provenance) (models.AlertRule, error) {
	storedRule, storedProvenance, err := service.GetAlertRule(ctx, rule.OrgID, rule.UID)
	if err != nil {
		return models.AlertRule{}, err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return models.AlertRule{}, fmt.Errorf("cannot changed provenance from '%s' to '%s'", storedProvenance, provenance)
	}
	rule.Updated = time.Now()
	rule.ID = storedRule.ID
	rule.IntervalSeconds = storedRule.IntervalSeconds
	err = rule.SetDashboardAndPanelFromAnnotations()
	if err != nil {
		return models.AlertRule{}, err
	}
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := service.ruleStore.UpdateAlertRules(ctx, []models.UpdateRule{
			{
				Existing: &storedRule,
				New:      rule,
			},
		})
		if err != nil {
			return err
		}
		return service.provenanceStore.SetProvenance(ctx, &rule, rule.OrgID, provenance)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, err
}

func (service *AlertRuleService) DeleteAlertRule(ctx context.Context, orgID int64, ruleUID string, provenance models.Provenance) error {
	rule := &models.AlertRule{
		OrgID: orgID,
		UID:   ruleUID,
	}
	// check that provenance is not changed in a invalid way
	storedProvenance, err := service.provenanceStore.GetProvenance(ctx, rule, rule.OrgID)
	if err != nil {
		return err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return fmt.Errorf("cannot delete with provided provenance '%s', needs '%s'", provenance, storedProvenance)
	}
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		return service.deleteRules(ctx, orgID, rule)
	})
}

// checkLimitsTransactionCtx checks whether the current transaction (as identified by the ctx) breaches configured alert rule limits.
func (service *AlertRuleService) checkLimitsTransactionCtx(ctx context.Context, orgID, userID int64) error {
	limitReached, err := service.quotas.CheckQuotaReached(ctx, models.QuotaTargetSrv, &quota.ScopeParameters{
		OrgID:  orgID,
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("failed to check alert rule quota: %w", err)
	}
	if limitReached {
		return models.ErrQuotaReached
	}
	return nil
}

// deleteRules deletes a set of target rules and associated data, while checking for database consistency.
func (service *AlertRuleService) deleteRules(ctx context.Context, orgID int64, targets ...*models.AlertRule) error {
	uids := make([]string, 0, len(targets))
	for _, tgt := range targets {
		if tgt != nil {
			uids = append(uids, tgt.UID)
		}
	}
	if err := service.ruleStore.DeleteAlertRulesByUID(ctx, orgID, uids...); err != nil {
		return err
	}
	for _, uid := range uids {
		if err := service.provenanceStore.DeleteProvenance(ctx, &models.AlertRule{UID: uid}, orgID); err != nil {
			// We failed to clean up the record, but this doesn't break things. Log it and move on.
			service.log.Warn("failed to delete provenance record for rule: %w", err)
		}
	}
	return nil
}

// GetAlertRuleGroupWithFolderTitle returns the alert rule group with folder title.
func (service *AlertRuleService) GetAlertRuleGroupWithFolderTitle(ctx context.Context, orgID int64, namespaceUID, group string) (models.AlertRuleGroupWithFolderTitle, error) {
	q := models.ListAlertRulesQuery{
		OrgID:         orgID,
		NamespaceUIDs: []string{namespaceUID},
		RuleGroup:     group,
	}
	ruleList, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return models.AlertRuleGroupWithFolderTitle{}, err
	}
	if len(ruleList) == 0 {
		return models.AlertRuleGroupWithFolderTitle{}, store.ErrAlertRuleGroupNotFound
	}

	dq := dashboards.GetDashboardQuery{
		OrgID: orgID,
		UID:   namespaceUID,
	}
	dash, err := service.dashboardService.GetDashboard(ctx, &dq)
	if err != nil {
		return models.AlertRuleGroupWithFolderTitle{}, err
	}

	res := models.AlertRuleGroupWithFolderTitle{
		AlertRuleGroup: &models.AlertRuleGroup{
			Title:     ruleList[0].RuleGroup,
			FolderUID: ruleList[0].NamespaceUID,
			Interval:  ruleList[0].IntervalSeconds,
			Rules:     []models.AlertRule{},
		},
		OrgID:       orgID,
		FolderTitle: dash.Title,
	}
	for _, r := range ruleList {
		if r != nil {
			res.AlertRuleGroup.Rules = append(res.AlertRuleGroup.Rules, *r)
		}
	}
	return res, nil
}

// GetAlertGroupsWithFolderTitle returns all groups with folder title that have at least one alert.
func (service *AlertRuleService) GetAlertGroupsWithFolderTitle(ctx context.Context, orgID int64) ([]models.AlertRuleGroupWithFolderTitle, error) {
	q := models.ListAlertRulesQuery{
		OrgID: orgID,
	}

	ruleList, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return nil, err
	}

	groups := make(map[models.AlertRuleGroupKey][]models.AlertRule)
	namespaces := make(map[string][]*models.AlertRuleGroupKey)
	for _, r := range ruleList {
		groupKey := r.GetGroupKey()
		group := groups[groupKey]
		group = append(group, *r)
		groups[groupKey] = group

		namespaces[r.NamespaceUID] = append(namespaces[r.NamespaceUID], &groupKey)
	}

	dq := dashboards.GetDashboardsQuery{
		DashboardUIDs: nil,
	}
	for uid := range namespaces {
		dq.DashboardUIDs = append(dq.DashboardUIDs, uid)
	}

	// We need folder titles for the provisioning file format. We do it this way instead of using GetUserVisibleNamespaces to avoid folder:read permissions that should not apply to those with alert.provisioning:read.
	dashes, err := service.dashboardService.GetDashboards(ctx, &dq)
	if err != nil {
		return nil, err
	}
	folderUidToTitle := make(map[string]string)
	for _, dash := range dashes {
		folderUidToTitle[dash.UID] = dash.Title
	}

	result := make([]models.AlertRuleGroupWithFolderTitle, 0)
	for groupKey, rules := range groups {
		title, ok := folderUidToTitle[groupKey.NamespaceUID]
		if !ok {
			return nil, fmt.Errorf("cannot find title for folder with uid '%s'", groupKey.NamespaceUID)
		}
		result = append(result, models.AlertRuleGroupWithFolderTitle{
			AlertRuleGroup: &models.AlertRuleGroup{
				Title:     rules[0].RuleGroup,
				FolderUID: rules[0].NamespaceUID,
				Interval:  rules[0].IntervalSeconds,
				Rules:     rules,
			},
			OrgID:       orgID,
			FolderTitle: title,
		})
	}

	// Return results in a stable manner.
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].AlertRuleGroup.FolderUID == result[j].AlertRuleGroup.FolderUID {
			return result[i].AlertRuleGroup.Title < result[j].AlertRuleGroup.Title
		}
		return result[i].AlertRuleGroup.FolderUID < result[j].AlertRuleGroup.FolderUID
	})

	return result, nil
}

// syncRuleGroupFields synchronizes calculated fields across multiple rules in a group.
func syncGroupRuleFields(group *models.AlertRuleGroup, orgID int64) *models.AlertRuleGroup {
	for i := range group.Rules {
		group.Rules[i].IntervalSeconds = group.Interval
		group.Rules[i].RuleGroup = group.Title
		group.Rules[i].NamespaceUID = group.FolderUID
		group.Rules[i].OrgID = orgID
	}
	return group
}

func withoutNilAlertRules(ptrs []*models.AlertRule) []models.AlertRule {
	result := make([]models.AlertRule, 0, len(ptrs))
	for _, ptr := range ptrs {
		if ptr != nil {
			result = append(result, *ptr)
		}
	}
	return result
}
