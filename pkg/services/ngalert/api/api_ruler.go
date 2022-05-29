package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
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
	xactManager     provisioning.TransactionManager
	provenanceStore provisioning.ProvisioningStore
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
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}
	var loggerCtx = []interface{}{
		"namespace",
		namespace.Title,
	}
	var ruleGroup string
	if group, ok := web.Params(c.Req)[":Groupname"]; ok {
		ruleGroup = group
		loggerCtx = append(loggerCtx, "group", group)
	}
	logger := srv.log.New(loggerCtx...)

	hasAccess := func(evaluator accesscontrol.Evaluator) bool {
		return accesscontrol.HasAccess(srv.ac, c)(accesscontrol.ReqOrgAdminOrEditor, evaluator)
	}

	provenances, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.OrgId, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to fetch provenances of alert rules")
	}

	var deletableRules []string
	err = srv.xactManager.InTransaction(c.Req.Context(), func(ctx context.Context) error {
		q := ngmodels.ListAlertRulesQuery{
			OrgID:         c.SignedInUser.OrgId,
			NamespaceUIDs: []string{namespace.Uid},
			RuleGroup:     ruleGroup,
		}
		if err = srv.store.ListAlertRules(ctx, &q); err != nil {
			return err
		}

		if len(q.Result) == 0 {
			logger.Debug("no alert rules to delete from namespace/group")
			return nil
		}

		var canDelete []*ngmodels.AlertRule
		var cannotDelete []string

		// partition will partation the given rules in two, one partition
		// being the rules that fulfill the predicate the other partation being
		// the ruleIDs not fulfilling it.
		partition := func(alerts []*ngmodels.AlertRule, predicate func(rule *ngmodels.AlertRule) bool) ([]*ngmodels.AlertRule, []string) {
			positive, negative := make([]*ngmodels.AlertRule, 0, len(alerts)), make([]string, 0, len(alerts))
			for _, rule := range alerts {
				if predicate(rule) {
					positive = append(positive, rule)
					continue
				}
				negative = append(negative, rule.UID)
			}
			return positive, negative
		}

		canDelete, cannotDelete = partition(q.Result, func(rule *ngmodels.AlertRule) bool {
			return authorizeDatasourceAccessForRule(rule, hasAccess)
		})
		if len(canDelete) == 0 {
			return fmt.Errorf("%w to delete rules because user is not authorized to access data sources used by the rules", ErrAuthorization)
		}
		if len(cannotDelete) > 0 {
			logger.Info("user cannot delete one or many alert rules because it does not have access to data sources. Those rules will be skipped", "expected", len(q.Result), "authorized", len(canDelete), "unauthorized", cannotDelete)
		}

		canDelete, cannotDelete = partition(canDelete, func(rule *ngmodels.AlertRule) bool {
			provenance, exists := provenances[rule.UID]
			return (exists && provenance == ngmodels.ProvenanceNone) || !exists
		})

		if len(canDelete) == 0 {
			return fmt.Errorf("all rules have been provisioned and cannot be deleted through this api")
		}

		if len(cannotDelete) > 0 {
			logger.Info("user cannot delete one or many alert rules because it does have a provenance set. Those rules will be skipped", "expected", len(q.Result), "provenance_none", len(canDelete), "provenance_set", cannotDelete)
		}

		for _, rule := range canDelete {
			deletableRules = append(deletableRules, rule.UID)
		}

		return srv.store.DeleteAlertRulesByUID(ctx, c.SignedInUser.OrgId, deletableRules...)
	})

	if err != nil {
		if errors.Is(err, ErrAuthorization) {
			return ErrResp(http.StatusUnauthorized, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to delete rule group")
	}

	logger.Debug("rules have been deleted from the store. updating scheduler")

	for _, uid := range deletableRules {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   uid,
		})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rules deleted"})
}

func (srv RulerSrv) RouteGetNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	q := ngmodels.ListAlertRulesQuery{
		OrgID:         c.SignedInUser.OrgId,
		NamespaceUIDs: []string{namespace.Uid},
	}
	if err := srv.store.ListAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to update rule group")
	}

	result := apimodels.NamespaceConfigResponse{}
	ruleGroupConfigs := make(map[string]apimodels.GettableRuleGroupConfig)

	hasAccess := func(evaluator accesscontrol.Evaluator) bool {
		return accesscontrol.HasAccess(srv.ac, c)(accesscontrol.ReqViewer, evaluator)
	}

	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.OrgId, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get provenance for rule group")
	}

	for _, r := range q.Result {
		if !authorizeDatasourceAccessForRule(r, hasAccess) {
			continue
		}
		ruleGroupConfig, ok := ruleGroupConfigs[r.RuleGroup]
		if !ok {
			ruleGroupInterval := model.Duration(time.Duration(r.IntervalSeconds) * time.Second)
			ruleGroupConfigs[r.RuleGroup] = apimodels.GettableRuleGroupConfig{
				Name:     r.RuleGroup,
				Interval: ruleGroupInterval,
				Rules: []apimodels.GettableExtendedRuleNode{
					toGettableExtendedRuleNode(*r, namespace.Id, provenanceRecords),
				},
			}
		} else {
			ruleGroupConfig.Rules = append(ruleGroupConfig.Rules, toGettableExtendedRuleNode(*r, namespace.Id, provenanceRecords))
			ruleGroupConfigs[r.RuleGroup] = ruleGroupConfig
		}
	}

	for _, ruleGroupConfig := range ruleGroupConfigs {
		result[namespaceTitle] = append(result[namespaceTitle], ruleGroupConfig)
	}

	return response.JSON(http.StatusAccepted, result)
}

func (srv RulerSrv) RouteGetRulesGroupConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	ruleGroup := web.Params(c.Req)[":Groupname"]
	q := ngmodels.ListAlertRulesQuery{
		OrgID:         c.SignedInUser.OrgId,
		NamespaceUIDs: []string{namespace.Uid},
		RuleGroup:     ruleGroup,
	}
	if err := srv.store.ListAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get group alert rules")
	}

	hasAccess := func(evaluator accesscontrol.Evaluator) bool {
		return accesscontrol.HasAccess(srv.ac, c)(accesscontrol.ReqViewer, evaluator)
	}

	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.OrgId, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get group alert rules")
	}

	groupRules := make([]*ngmodels.AlertRule, 0, len(q.Result))
	for _, r := range q.Result {
		if !authorizeDatasourceAccessForRule(r, hasAccess) {
			continue
		}
		groupRules = append(groupRules, r)
	}

	result := apimodels.RuleGroupConfigResponse{
		GettableRuleGroupConfig: toGettableRuleGroupConfig(ruleGroup, groupRules, namespace.Id, provenanceRecords),
	}
	return response.JSON(http.StatusAccepted, result)
}

func (srv RulerSrv) RouteGetRulesConfig(c *models.ReqContext) response.Response {
	namespaceMap, err := srv.store.GetUserVisibleNamespaces(c.Req.Context(), c.OrgId, c.SignedInUser)
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

	if err := srv.store.ListAlertRules(c.Req.Context(), &q); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rules")
	}

	hasAccess := func(evaluator accesscontrol.Evaluator) bool {
		return accesscontrol.HasAccess(srv.ac, c)(accesscontrol.ReqViewer, evaluator)
	}

	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.OrgId, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rules")
	}

	configs := make(map[ngmodels.AlertRuleGroupKey][]*ngmodels.AlertRule)
	for _, r := range q.Result {
		if !authorizeDatasourceAccessForRule(r, hasAccess) {
			continue
		}
		groupKey := r.GetGroupKey()
		group := configs[groupKey]
		group = append(group, r)
		configs[groupKey] = group
	}

	for groupKey, rules := range configs {
		folder, ok := namespaceMap[groupKey.NamespaceUID]
		if !ok {
			srv.log.Error("namespace not visible to the user", "user", c.SignedInUser.UserId, "namespace", groupKey.NamespaceUID)
			continue
		}
		namespace := folder.Title
		result[namespace] = append(result[namespace], toGettableRuleGroupConfig(groupKey.RuleGroup, rules, folder.Id, provenanceRecords))
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

	groupKey := ngmodels.AlertRuleGroupKey{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace.Uid,
		RuleGroup:    ruleGroupConfig.Name,
	}

	return srv.updateAlertRulesInGroup(c, groupKey, rules)
}

// updateAlertRulesInGroup calculates changes (rules to add,update,delete), verifies that the user is authorized to do the calculated changes and updates database.
// All operations are performed in a single transaction
// nolint: gocyclo
func (srv RulerSrv) updateAlertRulesInGroup(c *models.ReqContext, groupKey ngmodels.AlertRuleGroupKey, rules []*ngmodels.AlertRule) response.Response {
	var finalChanges *changes
	hasAccess := accesscontrol.HasAccess(srv.ac, c)
	err := srv.xactManager.InTransaction(c.Req.Context(), func(tranCtx context.Context) error {
		logger := srv.log.New("namespace_uid", groupKey.NamespaceUID, "group", groupKey.RuleGroup, "org_id", groupKey.OrgID, "user_id", c.UserId)
		groupChanges, err := calculateChanges(tranCtx, srv.store, groupKey, rules)
		if err != nil {
			return err
		}

		if groupChanges.isEmpty() {
			finalChanges = groupChanges
			logger.Info("no changes detected in the request. Do nothing")
			return nil
		}

		authorizedChanges := groupChanges // if RBAC is disabled the permission are limited to folder access that is done upstream
		if !srv.ac.IsDisabled() {
			authorizedChanges, err = authorizeRuleChanges(groupChanges, func(evaluator accesscontrol.Evaluator) bool {
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
		}

		provenances, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.OrgId, (&ngmodels.AlertRule{}).ResourceType())
		if err != nil {
			return err
		}

		// New rules don't need to be checked for provenance, just copy the whole slice.
		finalChanges = &changes{}
		finalChanges.New = authorizedChanges.New
		for _, rule := range authorizedChanges.Update {
			if provenance, exists := provenances[rule.Existing.UID]; (exists && provenance == ngmodels.ProvenanceNone) || !exists {
				finalChanges.Update = append(finalChanges.Update, rule)
			}
		}
		for _, rule := range authorizedChanges.Delete {
			if provenance, exists := provenances[rule.UID]; (exists && provenance == ngmodels.ProvenanceNone) || !exists {
				finalChanges.Delete = append(finalChanges.Delete, rule)
			}
		}

		if finalChanges.isEmpty() {
			logger.Info("no changes detected that have 'none' provenance in the request. Do nothing",
				"provenance_invalid_add", len(authorizedChanges.New),
				"provenance_invalid_update", len(authorizedChanges.Update),
				"provenance_invalid_delete", len(authorizedChanges.Delete))
			return nil
		}

		if len(authorizedChanges.Delete) > len(finalChanges.Delete) {
			logger.Info("provenance is not 'none' for one or many rules in the group that should be deleted. those rules will be skipped",
				"expected", len(authorizedChanges.Delete),
				"allowed", len(authorizedChanges.Delete))
		}

		if len(authorizedChanges.Update) > len(finalChanges.Update) {
			logger.Info("provenance is not 'none' for one or many rules in the group that should be updated. those rules will be skipped",
				"expected", len(authorizedChanges.Update),
				"allowed", len(authorizedChanges.Update))
		}

		logger.Debug("updating database with the authorized changes", "add", len(finalChanges.New), "update", len(finalChanges.New), "delete", len(finalChanges.Delete))

		if len(finalChanges.Update) > 0 || len(finalChanges.New) > 0 {
			updates := make([]store.UpdateRule, 0, len(finalChanges.Update))
			inserts := make([]ngmodels.AlertRule, 0, len(finalChanges.New))
			for _, update := range finalChanges.Update {
				logger.Debug("updating rule", "rule_uid", update.New.UID, "diff", update.Diff.String())
				updates = append(updates, store.UpdateRule{
					Existing: update.Existing,
					New:      *update.New,
				})
			}
			for _, rule := range finalChanges.New {
				inserts = append(inserts, *rule)
			}
			err = srv.store.InsertAlertRules(tranCtx, inserts)
			if err != nil {
				return fmt.Errorf("failed to add rules: %w", err)
			}
			err = srv.store.UpdateAlertRules(tranCtx, updates)
			if err != nil {
				return fmt.Errorf("failed to update rules: %w", err)
			}
		}

		if len(finalChanges.Delete) > 0 {
			UIDs := make([]string, 0, len(finalChanges.Delete))
			for _, rule := range finalChanges.Delete {
				UIDs = append(UIDs, rule.UID)
			}

			if err = srv.store.DeleteAlertRulesByUID(tranCtx, c.SignedInUser.OrgId, UIDs...); err != nil {
				return fmt.Errorf("failed to delete rules: %w", err)
			}
		}

		if len(finalChanges.New) > 0 {
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

	for _, rule := range finalChanges.Update {
		srv.scheduleService.UpdateAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   rule.Existing.UID,
		})
	}

	for _, rule := range finalChanges.Delete {
		srv.scheduleService.DeleteAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   rule.UID,
		})
	}

	if finalChanges.isEmpty() {
		return response.JSON(http.StatusAccepted, util.DynMap{"message": "no changes detected in the rule group"})
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rule group updated successfully"})
}

func toGettableRuleGroupConfig(groupName string, rules []*ngmodels.AlertRule, namespaceID int64, provenanceRecords map[string]ngmodels.Provenance) apimodels.GettableRuleGroupConfig {
	ruleNodes := make([]apimodels.GettableExtendedRuleNode, 0, len(rules))
	var interval time.Duration
	if len(rules) > 0 {
		interval = time.Duration(rules[0].IntervalSeconds) * time.Second
	}
	for _, r := range rules {
		ruleNodes = append(ruleNodes, toGettableExtendedRuleNode(*r, namespaceID, provenanceRecords))
	}
	return apimodels.GettableRuleGroupConfig{
		Name:     groupName,
		Interval: model.Duration(interval),
		Rules:    ruleNodes,
	}
}

func toGettableExtendedRuleNode(r ngmodels.AlertRule, namespaceID int64, provenanceRecords map[string]ngmodels.Provenance) apimodels.GettableExtendedRuleNode {
	provenance := ngmodels.ProvenanceNone
	if prov, exists := provenanceRecords[r.ResourceID()]; exists {
		provenance = prov
	}
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
			Provenance:      provenance,
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
	GroupKey ngmodels.AlertRuleGroupKey
	New      []*ngmodels.AlertRule
	Update   []ruleUpdate
	Delete   []*ngmodels.AlertRule
}

func (c *changes) isEmpty() bool {
	return len(c.Update)+len(c.New)+len(c.Delete) == 0
}

// calculateChanges calculates the difference between rules in the group in the database and the submitted rules. If a submitted rule has UID it tries to find it in the database (in other groups).
// returns a list of rules that need to be added, updated and deleted. Deleted considered rules in the database that belong to the group but do not exist in the list of submitted rules.
func calculateChanges(ctx context.Context, ruleStore store.RuleStore, groupKey ngmodels.AlertRuleGroupKey, submittedRules []*ngmodels.AlertRule) (*changes, error) {
	q := &ngmodels.ListAlertRulesQuery{
		OrgID:         groupKey.OrgID,
		NamespaceUIDs: []string{groupKey.NamespaceUID},
		RuleGroup:     groupKey.RuleGroup,
	}
	if err := ruleStore.ListAlertRules(ctx, q); err != nil {
		return nil, fmt.Errorf("failed to query database for rules in the group %s: %w", groupKey, err)
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
				q := &ngmodels.GetAlertRuleByUIDQuery{OrgID: groupKey.OrgID, UID: r.UID}
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
		GroupKey: groupKey,
		New:      toAdd,
		Delete:   toDelete,
		Update:   toUpdate,
	}, nil
}

// alertRuleFieldsToIgnoreInDiff contains fields that the AlertRule.Diff should ignore
var alertRuleFieldsToIgnoreInDiff = []string{"ID", "Version", "Updated"}
