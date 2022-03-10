package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/cmputil"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type RulerSrv struct {
	store           store.RuleStore
	DatasourceCache datasources.CacheService
	QuotaService    *quota.QuotaService
	scheduleService schedule.ScheduleService
	log             log.Logger
	cfg             *setting.UnifiedAlertingSettings
}

var (
	errQuotaReached = errors.New("quota has been exceeded")
)

func (srv RulerSrv) RouteDeleteNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	uids, err := srv.store.DeleteNamespaceAlertRules(c.Req.Context(), c.SignedInUser.OrgId, namespace.Uid)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to delete namespace alert rules")
	}

	for _, uid := range uids {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   uid,
		})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "namespace rules deleted"})
}

func (srv RulerSrv) RouteDeleteRuleGroupConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}
	ruleGroup := web.Params(c.Req)[":Groupname"]
	uids, err := srv.store.DeleteRuleGroupAlertRules(c.Req.Context(), c.SignedInUser.OrgId, namespace.Uid, ruleGroup)

	if err != nil {
		if errors.Is(err, ngmodels.ErrRuleGroupNamespaceNotFound) {
			return ErrResp(http.StatusNotFound, err, "failed to delete rule group")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to delete rule group")
	}

	for _, uid := range uids {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   uid,
		})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rule group deleted"})
}

func (srv RulerSrv) RouteGetNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	q := ngmodels.ListNamespaceAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace.Uid,
	}
	if err := srv.store.GetNamespaceAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to update rule group")
	}

	result := apimodels.NamespaceConfigResponse{}
	ruleGroupConfigs := make(map[string]apimodels.GettableRuleGroupConfig)
	for _, r := range q.Result {
		ruleGroupConfig, ok := ruleGroupConfigs[r.RuleGroup]
		if !ok {
			ruleGroupInterval := model.Duration(time.Duration(r.IntervalSeconds) * time.Second)
			ruleGroupConfigs[r.RuleGroup] = apimodels.GettableRuleGroupConfig{
				Name:     r.RuleGroup,
				Interval: ruleGroupInterval,
				Rules: []apimodels.GettableExtendedRuleNode{
					toGettableExtendedRuleNode(*r, namespace.Id),
				},
			}
		} else {
			ruleGroupConfig.Rules = append(ruleGroupConfig.Rules, toGettableExtendedRuleNode(*r, namespace.Id))
			ruleGroupConfigs[r.RuleGroup] = ruleGroupConfig
		}
	}

	for _, ruleGroupConfig := range ruleGroupConfigs {
		result[namespaceTitle] = append(result[namespaceTitle], ruleGroupConfig)
	}

	return response.JSON(http.StatusAccepted, result)
}

func (srv RulerSrv) RouteGetRulegGroupConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	ruleGroup := web.Params(c.Req)[":Groupname"]
	q := ngmodels.ListRuleGroupAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace.Uid,
		RuleGroup:    ruleGroup,
	}
	if err := srv.store.GetRuleGroupAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get group alert rules")
	}

	var ruleGroupInterval model.Duration
	ruleNodes := make([]apimodels.GettableExtendedRuleNode, 0, len(q.Result))
	for _, r := range q.Result {
		ruleGroupInterval = model.Duration(time.Duration(r.IntervalSeconds) * time.Second)
		ruleNodes = append(ruleNodes, toGettableExtendedRuleNode(*r, namespace.Id))
	}

	result := apimodels.RuleGroupConfigResponse{
		GettableRuleGroupConfig: apimodels.GettableRuleGroupConfig{
			Name:     ruleGroup,
			Interval: ruleGroupInterval,
			Rules:    ruleNodes,
		},
	}
	return response.JSON(http.StatusAccepted, result)
}

func (srv RulerSrv) RouteGetRulesConfig(c *models.ReqContext) response.Response {
	namespaceMap, err := srv.store.GetNamespaces(c.Req.Context(), c.OrgId, c.SignedInUser)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get namespaces visible to the user")
	}
	result := apimodels.NamespaceConfigResponse{}

	if len(namespaceMap) == 0 {
		srv.log.Debug("User has no access to any namespaces")
		return response.JSON(http.StatusOK, result)
	}

	namespaceUIDs := make([]string, len(namespaceMap))
	for k := range namespaceMap {
		namespaceUIDs = append(namespaceUIDs, k)
	}

	dashboardUID := c.Query("dashboard_uid")
	panelID, err := getPanelIDFromRequest(c.Req)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "invalid panel_id")
	}
	if dashboardUID == "" && panelID != 0 {
		return ErrResp(http.StatusBadRequest, errors.New("panel_id must be set with dashboard_uid"), "")
	}

	q := ngmodels.ListAlertRulesQuery{
		OrgID:         c.SignedInUser.OrgId,
		NamespaceUIDs: namespaceUIDs,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
	}

	if err := srv.store.GetOrgAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rules")
	}

	configs := make(map[string]map[string]apimodels.GettableRuleGroupConfig)
	for _, r := range q.Result {
		folder, ok := namespaceMap[r.NamespaceUID]
		if !ok {
			srv.log.Error("namespace not visible to the user", "user", c.SignedInUser.UserId, "namespace", r.NamespaceUID, "rule", r.UID)
			continue
		}
		namespace := folder.Title
		_, ok = configs[namespace]
		if !ok {
			ruleGroupInterval := model.Duration(time.Duration(r.IntervalSeconds) * time.Second)
			configs[namespace] = make(map[string]apimodels.GettableRuleGroupConfig)
			configs[namespace][r.RuleGroup] = apimodels.GettableRuleGroupConfig{
				Name:     r.RuleGroup,
				Interval: ruleGroupInterval,
				Rules: []apimodels.GettableExtendedRuleNode{
					toGettableExtendedRuleNode(*r, folder.Id),
				},
			}
		} else {
			ruleGroupConfig, ok := configs[namespace][r.RuleGroup]
			if !ok {
				ruleGroupInterval := model.Duration(time.Duration(r.IntervalSeconds) * time.Second)
				configs[namespace][r.RuleGroup] = apimodels.GettableRuleGroupConfig{
					Name:     r.RuleGroup,
					Interval: ruleGroupInterval,
					Rules: []apimodels.GettableExtendedRuleNode{
						toGettableExtendedRuleNode(*r, folder.Id),
					},
				}
			} else {
				ruleGroupConfig.Rules = append(ruleGroupConfig.Rules, toGettableExtendedRuleNode(*r, folder.Id))
				configs[namespace][r.RuleGroup] = ruleGroupConfig
			}
		}
	}

	for namespace, m := range configs {
		for _, ruleGroupConfig := range m {
			result[namespace] = append(result[namespace], ruleGroupConfig)
		}
	}
	return response.JSON(http.StatusOK, result)
}

func (srv RulerSrv) RoutePostNameRulesConfig(c *models.ReqContext, ruleGroupConfig apimodels.PostableRuleGroupConfig) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	rules, err := validateRuleGroup(&ruleGroupConfig, c.SignedInUser.OrgId, namespace, conditionValidator(c, srv.DatasourceCache), srv.cfg)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return srv.updateAlertRulesInGroup(c, namespace, ruleGroupConfig.Name, rules)
}

func (srv RulerSrv) updateAlertRulesInGroup(c *models.ReqContext, namespace *models.Folder, groupName string, rules []*ngmodels.AlertRule) response.Response {
	// TODO add create rules authz logic

	var groupChanges *changes = nil
	err := srv.store.InTransaction(c.Req.Context(), func(tranCtx context.Context) error {
		var err error
		groupChanges, err = calculateChanges(tranCtx, srv.store, c.SignedInUser.OrgId, namespace, groupName, rules)
		if err != nil {
			return err
		}

		if groupChanges.isEmpty() {
			srv.log.Info("no changes detected in the request. Do nothing")
			return nil
		}

		if len(groupChanges.Update) > 0 || len(groupChanges.New) > 0 {
			upsert := make([]store.UpsertRule, 0, len(groupChanges.Update)+len(groupChanges.New))
			for _, update := range groupChanges.Update {
				srv.log.Debug("updating rule", "uid", update.New.UID, "diff", update.Diff.String())
				upsert = append(upsert, store.UpsertRule{
					Existing: update.Existing,
					New:      *update.New,
				})
			}
			for _, rule := range groupChanges.New {
				upsert = append(upsert, store.UpsertRule{
					Existing: nil,
					New:      *rule,
				})
			}
			// TODO add update/delete authz logic
			err = srv.store.UpsertAlertRules(tranCtx, upsert)
			if err != nil {
				return fmt.Errorf("failed to add or update rules: %w", err)
			}
		}

		for _, rule := range groupChanges.Delete {
			if err = srv.store.DeleteAlertRuleByUID(tranCtx, c.SignedInUser.OrgId, rule.UID); err != nil {
				return fmt.Errorf("failed to delete rule %d with UID %s: %w", rule.ID, rule.UID, err)
			}
		}

		if len(groupChanges.New) > 0 {
			limitReached, err := srv.QuotaService.CheckQuotaReached(tranCtx, "alert_rule", &quota.ScopeParameters{
				OrgId:  c.OrgId,
				UserId: c.UserId,
			}) // alert rule is table name
			if err != nil {
				return fmt.Errorf("failed to get alert rules quota: %w", err)
			}
			if limitReached {
				return errQuotaReached
			}
		}
		return nil
	})

	if err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return ErrResp(http.StatusNotFound, err, "failed to update rule group")
		} else if errors.Is(err, ngmodels.ErrAlertRuleFailedValidation) {
			return ErrResp(http.StatusBadRequest, err, "failed to update rule group")
		} else if errors.Is(err, errQuotaReached) {
			return ErrResp(http.StatusForbidden, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to update rule group")
	}

	for _, rule := range groupChanges.Update {
		srv.scheduleService.UpdateAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   rule.Existing.UID,
		})
	}

	for _, rule := range groupChanges.Delete {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   rule.UID,
		})
	}

	if groupChanges.isEmpty() {
		return response.JSON(http.StatusAccepted, util.DynMap{"message": "no changes detected in the rule group"})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rule group updated successfully"})
}

func toGettableExtendedRuleNode(r ngmodels.AlertRule, namespaceID int64) apimodels.GettableExtendedRuleNode {
	gettableExtendedRuleNode := apimodels.GettableExtendedRuleNode{
		GrafanaManagedAlert: &apimodels.GettableGrafanaRule{
			ID:              r.ID,
			OrgID:           r.OrgID,
			Title:           r.Title,
			Condition:       r.Condition,
			Data:            r.Data,
			Updated:         r.Updated,
			IntervalSeconds: r.IntervalSeconds,
			Version:         r.Version,
			UID:             r.UID,
			NamespaceUID:    r.NamespaceUID,
			NamespaceID:     namespaceID,
			RuleGroup:       r.RuleGroup,
			NoDataState:     apimodels.NoDataState(r.NoDataState),
			ExecErrState:    apimodels.ExecutionErrorState(r.ExecErrState),
		},
	}
	gettableExtendedRuleNode.ApiRuleNode = &apimodels.ApiRuleNode{
		For:         model.Duration(r.For),
		Annotations: r.Annotations,
		Labels:      r.Labels,
	}
	return gettableExtendedRuleNode
}

func toNamespaceErrorResponse(err error) response.Response {
	if errors.Is(err, ngmodels.ErrCannotEditNamespace) {
		return ErrResp(http.StatusForbidden, err, err.Error())
	}
	if errors.Is(err, models.ErrDashboardIdentifierNotSet) {
		return ErrResp(http.StatusBadRequest, err, err.Error())
	}
	return apierrors.ToFolderErrorResponse(err)
}

type ruleUpdate struct {
	Existing *ngmodels.AlertRule
	New      *ngmodels.AlertRule
	Diff     cmputil.DiffReport
}

type changes struct {
	New    []*ngmodels.AlertRule
	Update []ruleUpdate
	Delete []*ngmodels.AlertRule
}

func (c *changes) isEmpty() bool {
	return len(c.Update)+len(c.New)+len(c.Delete) == 0
}

// calculateChanges calculates the difference between rules in the group in the database and the submitted rules. If a submitted rule has UID it tries to find it in the database (in other groups).
// returns a list of rules that need to be added, updated and deleted. Deleted considered rules in the database that belong to the group but do not exist in the list of submitted rules.
func calculateChanges(ctx context.Context, ruleStore store.RuleStore, orgId int64, namespace *models.Folder, ruleGroupName string, submittedRules []*ngmodels.AlertRule) (*changes, error) {
	q := &ngmodels.ListRuleGroupAlertRulesQuery{
		OrgID:        orgId,
		NamespaceUID: namespace.Uid,
		RuleGroup:    ruleGroupName,
	}
	if err := ruleStore.GetRuleGroupAlertRules(ctx, q); err != nil {
		return nil, fmt.Errorf("failed to query database for rules in the group %s: %w", ruleGroupName, err)
	}
	existingGroupRules := q.Result

	existingGroupRulesUIDs := make(map[string]*ngmodels.AlertRule, len(existingGroupRules))
	for _, r := range existingGroupRules {
		existingGroupRulesUIDs[r.UID] = r
	}

	var toAdd, toDelete []*ngmodels.AlertRule
	var toUpdate []ruleUpdate
	for _, r := range submittedRules {
		var existing *ngmodels.AlertRule = nil

		if r.UID != "" {
			if existingGroupRule, ok := existingGroupRulesUIDs[r.UID]; ok {
				existing = existingGroupRule
				// remove the rule from existingGroupRulesUIDs
				delete(existingGroupRulesUIDs, r.UID)
			} else {
				// Rule can be from other group or namespace
				q := &ngmodels.GetAlertRuleByUIDQuery{OrgID: orgId, UID: r.UID}
				if err := ruleStore.GetAlertRuleByUID(ctx, q); err != nil || q.Result == nil {
					// if rule has UID then it is considered an update. Therefore, fail if there is no rule to update
					if errors.Is(err, ngmodels.ErrAlertRuleNotFound) || q.Result == nil && err == nil {
						return nil, fmt.Errorf("failed to update rule with UID %s because %w", r.UID, ngmodels.ErrAlertRuleNotFound)
					}
					return nil, fmt.Errorf("failed to query database for an alert rule with UID %s: %w", r.UID, err)
				}
				existing = q.Result
			}
		}

		if existing == nil {
			toAdd = append(toAdd, r)
			continue
		}

		ngmodels.PatchPartialAlertRule(existing, r)

		diff := existing.Diff(r, alertRuleFieldsToIgnoreInDiff...)
		if len(diff) == 0 {
			continue
		}

		toUpdate = append(toUpdate, ruleUpdate{
			Existing: existing,
			New:      r,
			Diff:     diff,
		})
		continue
	}

	for _, rule := range existingGroupRulesUIDs {
		toDelete = append(toDelete, rule)
	}

	return &changes{
		New:    toAdd,
		Delete: toDelete,
		Update: toUpdate,
	}, nil
}

// alertRuleFieldsToIgnoreInDiff contains fields that the AlertRule.Diff should ignore
var alertRuleFieldsToIgnoreInDiff = []string{"ID", "Version", "Updated"}
