package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type PrometheusSrv struct {
	log     log.Logger
	manager *state.Manager
	store   store.RuleStore
}

func (srv PrometheusSrv) RouteGetAlertStatuses(c *models.ReqContext) response.Response {
	alertResponse := apimodels.AlertResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.AlertDiscovery{
			Alerts: []*apimodels.Alert{},
		},
	}
	for _, alertState := range srv.manager.GetAll(c.OrgId) {
		startsAt := alertState.StartsAt
		valString := ""
		if alertState.State == eval.Alerting {
			valString = alertState.LastEvaluationString
		}

		alertResponse.Data.Alerts = append(alertResponse.Data.Alerts, &apimodels.Alert{
			Labels:      map[string]string(alertState.Labels),
			Annotations: alertState.Annotations,
			State:       alertState.State.String(),
			ActiveAt:    &startsAt,
			Value:       valString,
		})
	}

	return response.JSON(http.StatusOK, alertResponse)
}

func getPanelIDFromRequest(r *http.Request) (int64, error) {
	if s := strings.TrimSpace(r.URL.Query().Get("panel_id")); s != "" {
		return strconv.ParseInt(s, 10, 64)
	}
	return 0, nil
}

func (srv PrometheusSrv) RouteGetRuleStatuses(c *models.ReqContext) response.Response {
	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{
			RuleGroups: []*apimodels.RuleGroup{},
		},
	}

	namespaceMap, err := srv.store.GetNamespaces(c.Req.Context(), c.OrgId, c.SignedInUser)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get namespaces visible to the user")
	}

	if len(namespaceMap) == 0 {
		srv.log.Debug("User does not have access to any namespaces")
		return response.JSON(http.StatusOK, ruleResponse)
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

	ruleGroupQuery := ngmodels.ListOrgRuleGroupsQuery{
		OrgID:         c.SignedInUser.OrgId,
		NamespaceUIDs: namespaceUIDs,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
	}
	if err := srv.store.GetOrgRuleGroups(c.Req.Context(), &ruleGroupQuery); err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting rule groups: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
		return response.JSON(http.StatusInternalServerError, ruleResponse)
	}

	alertRuleQuery := ngmodels.ListAlertRulesQuery{
		OrgID:        c.SignedInUser.OrgId,
		DashboardUID: dashboardUID,
		PanelID:      panelID,
	}
	if err := srv.store.GetOrgAlertRules(c.Req.Context(), &alertRuleQuery); err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting rules: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
		return response.JSON(http.StatusInternalServerError, ruleResponse)
	}

	groupMap := make(map[string]*apimodels.RuleGroup)

	for _, r := range ruleGroupQuery.Result {
		if len(r) < 3 {
			continue
		}
		groupId, namespaceUID, namespace := r[0], r[1], r[2]

		newGroup := &apimodels.RuleGroup{
			Name: groupId,
			// This doesn't make sense in our architecture
			// so we use this field for passing to the frontend the namespace
			File:           namespace,
			LastEvaluation: time.Time{},
			EvaluationTime: 0, // TODO: see if we are able to pass this along with evaluation results
		}

		groupMap[groupId+"-"+namespaceUID] = newGroup

		ruleResponse.Data.RuleGroups = append(ruleResponse.Data.RuleGroups, newGroup)
	}

	for _, rule := range alertRuleQuery.Result {
		newGroup, ok := groupMap[rule.RuleGroup+"-"+rule.NamespaceUID]
		if !ok {
			continue
		}
		var queryStr string
		encodedQuery, err := json.Marshal(rule.Data)
		if err != nil {
			queryStr = err.Error()
		} else {
			queryStr = string(encodedQuery)
		}
		alertingRule := apimodels.AlertingRule{
			State:       "inactive",
			Name:        rule.Title,
			Query:       queryStr,
			Duration:    rule.For.Seconds(),
			Annotations: rule.Annotations,
		}

		newRule := apimodels.Rule{
			Name:           rule.Title,
			Labels:         rule.Labels,
			Health:         "ok",
			Type:           apiv1.RuleTypeAlerting,
			LastEvaluation: time.Time{},
		}

		for _, alertState := range srv.manager.GetStatesForRuleUID(c.OrgId, rule.UID) {
			activeAt := alertState.StartsAt
			valString := ""
			if alertState.State == eval.Alerting {
				valString = alertState.LastEvaluationString
			}
			alert := &apimodels.Alert{
				Labels:      map[string]string(alertState.Labels),
				Annotations: alertState.Annotations,
				State:       alertState.State.String(),
				ActiveAt:    &activeAt,
				Value:       valString, // TODO: set this once it is added to the evaluation results
			}

			if alertState.LastEvaluationTime.After(newRule.LastEvaluation) {
				newRule.LastEvaluation = alertState.LastEvaluationTime
				newGroup.LastEvaluation = alertState.LastEvaluationTime
			}

			newRule.EvaluationTime = alertState.EvaluationDuration.Seconds()

			switch alertState.State {
			case eval.Normal:
			case eval.Pending:
				if alertingRule.State == "inactive" {
					alertingRule.State = "pending"
				}
			case eval.Alerting:
				alertingRule.State = "firing"
			case eval.Error:
				newRule.Health = "error"
			case eval.NoData:
				newRule.Health = "nodata"
			}

			if alertState.Error != nil {
				newRule.LastError = alertState.Error.Error()
				newRule.Health = "error"
			}
			alertingRule.Alerts = append(alertingRule.Alerts, alert)
		}

		alertingRule.Rule = newRule
		newGroup.Rules = append(newGroup.Rules, alertingRule)
		newGroup.Interval = float64(rule.IntervalSeconds)
	}
	return response.JSON(http.StatusOK, ruleResponse)
}
