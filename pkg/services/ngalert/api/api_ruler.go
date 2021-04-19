package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/store"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	coreapi "github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/common/model"
)

type RulerSrv struct {
	store store.RuleStore
	log   log.Logger
}

func (srv RulerSrv) RouteDeleteNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespaceTitle := c.Params(":Namespace")
	namespace, err := srv.store.GetNamespaceByTitle(namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	if err := srv.store.DeleteNamespaceAlertRules(c.SignedInUser.OrgId, namespace.Uid); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to delete namespace alert rules", err)
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "namespace rules deleted"})
}

func (srv RulerSrv) RouteDeleteRuleGroupConfig(c *models.ReqContext) response.Response {
	namespaceTitle := c.Params(":Namespace")
	namespace, err := srv.store.GetNamespaceByTitle(namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}
	ruleGroup := c.Params(":Groupname")
	if err := srv.store.DeleteRuleGroupAlertRules(c.SignedInUser.OrgId, namespace.Uid, ruleGroup); err != nil {
		if errors.Is(err, ngmodels.ErrRuleGroupNamespaceNotFound) {
			return response.Error(http.StatusNotFound, "failed to delete rule group", err)
		}
		return response.Error(http.StatusInternalServerError, "failed to delete rule group", err)
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rule group deleted"})
}

func (srv RulerSrv) RouteGetNamespaceRulesConfig(c *models.ReqContext) response.Response {
	namespaceTitle := c.Params(":Namespace")
	namespace, err := srv.store.GetNamespaceByTitle(namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	q := ngmodels.ListNamespaceAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace.Uid,
	}
	if err := srv.store.GetNamespaceAlertRules(&q); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to update rule group", err)
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
	namespaceTitle := c.Params(":Namespace")
	namespace, err := srv.store.GetNamespaceByTitle(namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, false)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	ruleGroup := c.Params(":Groupname")
	q := ngmodels.ListRuleGroupAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		NamespaceUID: namespace.Uid,
		RuleGroup:    ruleGroup,
	}
	if err := srv.store.GetRuleGroupAlertRules(&q); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get group alert rules", err)
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
	q := ngmodels.ListAlertRulesQuery{
		OrgID: c.SignedInUser.OrgId,
	}
	if err := srv.store.GetOrgAlertRules(&q); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get alert rules", err)
	}

	configs := make(map[string]map[string]apimodels.GettableRuleGroupConfig)
	for _, r := range q.Result {
		folder, err := srv.store.GetNamespaceByUID(r.NamespaceUID, c.SignedInUser.OrgId, c.SignedInUser)
		if err != nil {
			return toNamespaceErrorResponse(err)
		}
		namespace := folder.Title
		_, ok := configs[namespace]
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

	result := apimodels.NamespaceConfigResponse{}
	for namespace, m := range configs {
		for _, ruleGroupConfig := range m {
			result[namespace] = append(result[namespace], ruleGroupConfig)
		}
	}
	return response.JSON(http.StatusAccepted, result)
}

func (srv RulerSrv) RoutePostNameRulesConfig(c *models.ReqContext, ruleGroupConfig apimodels.PostableRuleGroupConfig) response.Response {
	namespaceTitle := c.Params(":Namespace")
	namespace, err := srv.store.GetNamespaceByTitle(namespaceTitle, c.SignedInUser.OrgId, c.SignedInUser, true)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	// TODO check permissions
	// TODO check quota
	// TODO validate UID uniqueness in the payload

	//TODO: Should this belong in alerting-api?
	if ruleGroupConfig.Name == "" {
		return response.Error(http.StatusBadRequest, "rule group name is not valid", nil)
	}

	if err := srv.store.UpdateRuleGroup(store.UpdateRuleGroupCmd{
		OrgID:           c.SignedInUser.OrgId,
		NamespaceUID:    namespace.Uid,
		RuleGroupConfig: ruleGroupConfig,
	}); err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return response.Error(http.StatusNotFound, "failed to update rule group", err)
		}
		return response.Error(http.StatusInternalServerError, "failed to update rule group", err)
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

func toPostableExtendedRuleNode(r ngmodels.AlertRule) apimodels.PostableExtendedRuleNode {
	postableExtendedRuleNode := apimodels.PostableExtendedRuleNode{
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			OrgID:        r.OrgID,
			Title:        r.Title,
			Condition:    r.Condition,
			Data:         r.Data,
			UID:          r.UID,
			NoDataState:  apimodels.NoDataState(r.NoDataState),
			ExecErrState: apimodels.ExecutionErrorState(r.ExecErrState),
		},
	}
	postableExtendedRuleNode.ApiRuleNode = &apimodels.ApiRuleNode{
		For:         model.Duration(r.For),
		Annotations: r.Annotations,
		Labels:      r.Labels,
	}
	return postableExtendedRuleNode
}

func toNamespaceErrorResponse(err error) response.Response {
	if errors.Is(err, ngmodels.ErrCannotEditNamespace) {
		return response.Error(http.StatusForbidden, err.Error(), err)
	}
	if errors.Is(err, models.ErrDashboardIdentifierNotSet) {
		return response.Error(http.StatusBadRequest, err.Error(), err)
	}
	return coreapi.ToFolderErrorResponse(err)
}
