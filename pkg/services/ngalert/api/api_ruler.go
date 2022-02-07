package api

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"

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
}

func (srv RulerSrv) RouteDeleteNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespaceTitle := web.Params(c.Req)[":Namespace"]
	namespace, err := srv.store.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	uids, err := srv.store.DeleteNamespaceAlertRules(c.SignedInUser.OrgId, namespace.Uid)
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
	uids, err := srv.store.DeleteRuleGroupAlertRules(c.SignedInUser.OrgId, namespace.Uid, ruleGroup)

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
	if err := srv.store.GetNamespaceAlertRules(&q); err != nil {
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
	if err := srv.store.GetRuleGroupAlertRules(&q); err != nil {
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

	if err := srv.store.GetOrgAlertRules(&q); err != nil {
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

	//TODO: Should this belong in alerting-api?
	if ruleGroupConfig.Name == "" {
		return ErrResp(http.StatusBadRequest, errors.New("rule group name is not valid"), "")
	}

	alertRuleUIDs := make(map[string]struct{})
	for _, r := range ruleGroupConfig.Rules {
		cond := ngmodels.Condition{
			Condition: r.GrafanaManagedAlert.Condition,
			OrgID:     c.SignedInUser.OrgId,
			Data:      r.GrafanaManagedAlert.Data,
		}
		if err := validateCondition(c.Req.Context(), cond, c.SignedInUser, c.SkipCache, srv.DatasourceCache); err != nil {
			return ErrResp(http.StatusBadRequest, err, "failed to validate alert rule %q", r.GrafanaManagedAlert.Title)
		}
		if r.GrafanaManagedAlert.UID != "" {
			_, ok := alertRuleUIDs[r.GrafanaManagedAlert.UID]
			if ok {
				return ErrResp(http.StatusBadRequest, fmt.Errorf("conflicting UID %q found", r.GrafanaManagedAlert.UID), "failed to validate alert rule %q", r.GrafanaManagedAlert.Title)
			}
			alertRuleUIDs[r.GrafanaManagedAlert.UID] = struct{}{}
		}
	}

	numOfNewRules := len(ruleGroupConfig.Rules) - len(alertRuleUIDs)
	if numOfNewRules > 0 {
		// quotas are checked in advanced
		// that is acceptable under the assumption that there will be only one alert rule under the rule group
		// alternatively we should check the quotas after the rule group update
		// and rollback the transaction in case of violation
		limitReached, err := srv.QuotaService.QuotaReached(c, "alert_rule")
		if err != nil {
			return ErrResp(http.StatusInternalServerError, err, "failed to get quota")
		}
		if limitReached {
			return ErrResp(http.StatusForbidden, errors.New("quota reached"), "")
		}
	}

	if err := srv.store.UpdateRuleGroup(store.UpdateRuleGroupCmd{
		OrgID:           c.SignedInUser.OrgId,
		NamespaceUID:    namespace.Uid,
		RuleGroupConfig: ruleGroupConfig,
	}); err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return ErrResp(http.StatusNotFound, err, "failed to update rule group")
		} else if errors.Is(err, ngmodels.ErrAlertRuleFailedValidation) {
			return ErrResp(http.StatusBadRequest, err, "failed to update rule group")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to update rule group")
	}

	for uid := range alertRuleUIDs {
		srv.scheduleService.UpdateAlertRule(ngmodels.AlertRuleKey{
			OrgID: c.SignedInUser.OrgId,
			UID:   uid,
		})
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
