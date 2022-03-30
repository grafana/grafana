package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
	xactManager     store.TransactionManager
	store           store.RuleStore
	DatasourceCache datasources.CacheService
	QuotaService    *quota.QuotaService
	scheduleService schedule.ScheduleService
	log             log.Logger
	cfg             *setting.UnifiedAlertingSettings
	ac              accesscontrol.AccessControl
}

var (
	errQuotaReached = errors.New("quota has been exceeded")
)

// RouteDeleteAlertRules deletes all alert rules user is authorized to access in the namespace (request parameter :Namespace)
// or, if specified, a group of rules (request parameter :Groupname) in the namespace
func (srv RulerSrv) RouteDeleteAlertRules(c *models.ReqContext) response.Response {
	namespace := web.Params(c.Req)[":Namespace"]
	var loggerCtx = []interface{}{
		"namespace",
		namespace,
	}
	var ruleGroup *string
	if groupName, ok := web.Params(c.Req)[":Groupname"]; ok {
		folder, err := srv.store.GetFolderByTitle(c.Req.Context(), groupName, c.SignedInUser.OrgId, c.SignedInUser, true)
		if err != nil {
			return toGroupNameErrorResponse(err)
		}
		ruleGroup = &folder.Uid
		loggerCtx = append(loggerCtx, "group", folder.Uid)
	}
	logger := srv.log.New(loggerCtx...)

	hasAccess := func(evaluator accesscontrol.Evaluator) bool {
		return accesscontrol.HasAccess(srv.ac, c)(accesscontrol.ReqOrgAdminOrEditor, evaluator)
	}

	var canDelete, cannotDelete []string
	err := srv.xactManager.InTransaction(c.Req.Context(), func(ctx context.Context) error {
		q := ngmodels.GetAlertRulesQuery{
			OrgID:        c.SignedInUser.OrgId,
			NamespaceUID: namespace,
			RuleGroup:    ruleGroup,
		}
		if err := srv.store.GetAlertRules(ctx, &q); err != nil {
			return err
		}

		if len(q.Result) == 0 {
			logger.Debug("no alert rules to delete from namespace/group")
			return nil
		}

		canDelete = make([]string, 0, len(q.Result))
		for _, rule := range q.Result {
			if authorizeDatasourceAccessForRule(rule, hasAccess) {
				canDelete = append(canDelete, rule.UID)
				continue
			}
			cannotDelete = append(cannotDelete, rule.UID)
		}

		if len(canDelete) == 0 {
			return fmt.Errorf("%w to delete rules because user is not authorized to access data sources used by the rules", ErrAuthorization)
		}

		if len(cannotDelete) > 0 {
			logger.Info("user cannot delete one or many alert rules because it does not have access to data sources. Those rules will be skipped", "expected", len(q.Result), "authorized", len(canDelete), "unauthorized", cannotDelete)
		}

		return srv.store.DeleteAlertRulesByUID(ctx, c.SignedInUser.OrgId, canDelete...)
	})

	if err != nil {
		if errors.Is(err, ErrAuthorization) {
			return ErrResp(http.StatusUnauthorized, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to delete rule group")
	}

	logger.Debug("rules have been deleted from the store. updating scheduler")

	for _, uid := range canDelete {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   uid,
		})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rules deleted"})
}

func (srv RulerSrv) RouteGetNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespace := web.Params(c.Req)[":Namespace"]

	q := ngmodels.ListNamespaceAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace,
	}
	if err := srv.store.GetNamespaceAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to fetch rules for namespace")
	}

	result := apimodels.NamespaceConfigResponse{}
	ruleGroupConfigs := make(map[string]apimodels.GettableRuleGroupConfig)

	for groupName, rules := range q.Result {
		for _, rule := range rules {
			ruleGroupConfig, ok := ruleGroupConfigs[groupName]
			if !ok {
				ruleGroupInterval := model.Duration(time.Duration(rule.IntervalSeconds) * time.Second)
				ruleGroupConfigs[groupName] = apimodels.GettableRuleGroupConfig{
					Name:     groupName,
					Interval: ruleGroupInterval,
					Rules: []apimodels.GettableExtendedRuleNode{
						toGettableExtendedRuleNode(*rule),
					},
				}
			} else {
				ruleGroupConfig.Rules = append(ruleGroupConfig.Rules, toGettableExtendedRuleNode(*rule))
				ruleGroupConfigs[groupName] = ruleGroupConfig
			}
		}
	}

	for _, ruleGroupConfig := range ruleGroupConfigs {
		result[namespace] = append(result[namespace], ruleGroupConfig)
	}

	return response.JSON(http.StatusAccepted, result)
}

func (srv RulerSrv) RouteGetRulegGroupConfig(c *models.ReqContext) response.Response {
	namespace := web.Params(c.Req)[":Namespace"]
	groupName := web.Params(c.Req)[":Groupname"]

	folder, err := srv.store.GetFolderByTitle(c.Req.Context(), groupName, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toGroupNameErrorResponse(err)
	}

	ruleGroup := web.Params(c.Req)[":Groupname"]
	q := ngmodels.GetAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace,
		RuleGroup:    &folder.Uid,
	}
	if err := srv.store.GetAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get group alert rules")
	}

	var ruleGroupInterval model.Duration
	ruleNodes := make([]apimodels.GettableExtendedRuleNode, 0, len(q.Result))
	for _, r := range q.Result {
		ruleGroupInterval = model.Duration(time.Duration(r.IntervalSeconds) * time.Second)
		ruleNodes = append(ruleNodes, toGettableExtendedRuleNode(*r))
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
	namespaceMap, err := srv.store.GetNamespacesWithGroups(c.Req.Context(), c.OrgId, c.SignedInUser)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get namespaces visible to the user")
	}

	namespaceUIDs := make([]string, len(namespaceMap))
	for namespace := range namespaceMap {
		namespaceUIDs = append(namespaceUIDs, namespace)
	}

	result := apimodels.NamespaceConfigResponse{}

	if len(namespaceMap) == 0 {
		srv.log.Debug("User has no access to any namespaces")
		return response.JSON(http.StatusOK, result)
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
		NamespaceUIDs: namespaceUIDs,
		OrgID:         c.SignedInUser.OrgId,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
	}

	if err := srv.store.GetOrgAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rules")
	}

	// we'll use this for a reverse lookup when we add the rules
	groupUidToTitle := make(map[string]string)

	// prepare the response structure based on the namespace -> groupname mapping
	configs := make(map[string]map[string]apimodels.GettableRuleGroupConfig)
	for namespace, folders := range namespaceMap {
		for _, folder := range folders {
			groupUidToTitle[folder.Uid] = folder.Title

			configs[namespace] = make(map[string]apimodels.GettableRuleGroupConfig)
			configs[namespace][folder.Title] = apimodels.GettableRuleGroupConfig{
				Name: folder.Title,
				// TODO figure this out! The interval seems to be determined by the rule interval – that's fine but now we can have multiple
				// rules in a groupname :(
				Interval: model.Duration(1 * time.Minute),
				Rules:    []apimodels.GettableExtendedRuleNode{},
			}
		}
	}

	// add the rules to the correct groups
	for _, rule := range q.Result {
		namespace := rule.NamespaceUID
		groupName := groupUidToTitle[rule.RuleGroup]
		ruleGroupInterval := model.Duration(time.Duration(rule.IntervalSeconds) * time.Second)

		group, ok := configs[namespace][groupName]
		if !ok {
			srv.log.Error("group not visible to the user", "user", c.SignedInUser.UserId, "namespace", namespace, "group", groupName, "rule", rule.UID)
		}

		configs[namespace][groupName] = apimodels.GettableRuleGroupConfig{
			Name:     groupName,
			Interval: ruleGroupInterval,
			Rules:    append(group.Rules, toGettableExtendedRuleNode(*rule)),
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
	namespace := web.Params(c.Req)[":Namespace"]
	groupName := ruleGroupConfig.Name
	orgId := c.SignedInUser.OrgId

	folder, err := srv.store.GetFolderByTitle(c.Req.Context(), groupName, orgId, c.SignedInUser, true)
	if err != nil {
		return toGroupNameErrorResponse(err)
	}

	rules, err := validateRuleGroup(&ruleGroupConfig, orgId, namespace, folder, conditionValidator(c, srv.DatasourceCache), srv.cfg)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return srv.updateAlertRulesInGroup(c, namespace, folder, rules)
}

// updateAlertRulesInGroup calculates changes (rules to add,update,delete), verifies that the user is authorized to do the calculated changes and updates database.
// All operations are performed in a single transaction
func (srv RulerSrv) updateAlertRulesInGroup(c *models.ReqContext, namespace string, group *models.Folder, rules []*ngmodels.AlertRule) response.Response {
	var authorizedChanges *changes
	hasAccess := accesscontrol.HasAccess(srv.ac, c)
	err := srv.xactManager.InTransaction(c.Req.Context(), func(tranCtx context.Context) error {
		logger := srv.log.New("namespace_uid", namespace, "group", group.Uid, "org_id", c.OrgId, "user_id", c.UserId)

		groupChanges, err := calculateChanges(tranCtx, srv.store, c.SignedInUser.OrgId, namespace, group.Uid, rules)
		if err != nil {
			return err
		}

		if groupChanges.isEmpty() {
			authorizedChanges = groupChanges
			logger.Info("no changes detected in the request. Do nothing")
			return nil
		}

		authorizedChanges, err = authorizeRuleChanges(group, groupChanges, func(evaluator accesscontrol.Evaluator) bool {
			return hasAccess(accesscontrol.ReqOrgAdminOrEditor, evaluator)
		})
		if err != nil {
			return err
		}

		if authorizedChanges.isEmpty() {
			logger.Info("no authorized changes detected in the request. Do nothing", "not_authorized_add", len(groupChanges.New), "not_authorized_update", len(groupChanges.Update), "not_authorized_delete", len(groupChanges.Delete))
			return nil
		}

		if len(groupChanges.Delete) > len(authorizedChanges.Delete) {
			logger.Info("user is not authorized to delete one or many rules in the group. those rules will be skipped", "expected", len(groupChanges.Delete), "authorized", len(authorizedChanges.Delete))
		}

		logger.Debug("updating database with the authorized changes", "add", len(authorizedChanges.New), "update", len(authorizedChanges.New), "delete", len(authorizedChanges.Delete))

		if len(authorizedChanges.Update) > 0 || len(authorizedChanges.New) > 0 {
			upsert := make([]store.UpsertRule, 0, len(authorizedChanges.Update)+len(authorizedChanges.New))
			for _, update := range authorizedChanges.Update {
				logger.Debug("updating rule", "rule_uid", update.New.UID, "diff", update.Diff.String())
				upsert = append(upsert, store.UpsertRule{
					Existing: update.Existing,
					New:      *update.New,
				})
			}
			for _, rule := range authorizedChanges.New {
				upsert = append(upsert, store.UpsertRule{
					Existing: nil,
					New:      *rule,
				})
			}
			err = srv.store.UpsertAlertRules(tranCtx, upsert)
			if err != nil {
				return fmt.Errorf("failed to add or update rules: %w", err)
			}
		}

		if len(authorizedChanges.Delete) > 0 {
			UIDs := make([]string, 0, len(authorizedChanges.Delete))
			for _, rule := range authorizedChanges.Delete {
				UIDs = append(UIDs, rule.UID)
			}

			if err = srv.store.DeleteAlertRulesByUID(tranCtx, c.SignedInUser.OrgId, UIDs...); err != nil {
				return fmt.Errorf("failed to delete rules: %w", err)
			}
		}

		if len(authorizedChanges.New) > 0 {
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
		} else if errors.Is(err, ErrAuthorization) {
			return ErrResp(http.StatusUnauthorized, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to update rule group")
	}

	for _, rule := range authorizedChanges.Update {
		srv.scheduleService.UpdateAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   rule.Existing.UID,
		})
	}

	for _, rule := range authorizedChanges.Delete {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   rule.UID,
		})
	}

	if authorizedChanges.isEmpty() {
		return response.JSON(http.StatusAccepted, util.DynMap{"message": "no changes detected in the rule group"})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rule group updated successfully"})
}

func toGettableExtendedRuleNode(r ngmodels.AlertRule) apimodels.GettableExtendedRuleNode {
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

func toGroupNameErrorResponse(err error) response.Response {
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
func calculateChanges(ctx context.Context, ruleStore store.RuleStore, orgId int64, namespace string, ruleGroupName string, submittedRules []*ngmodels.AlertRule) (*changes, error) {
	q := &ngmodels.GetAlertRulesQuery{
		OrgID:        orgId,
		NamespaceUID: namespace,
		RuleGroup:    &ruleGroupName,
	}
	if err := ruleStore.GetAlertRules(ctx, q); err != nil {
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
