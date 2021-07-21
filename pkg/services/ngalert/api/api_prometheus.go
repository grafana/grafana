package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

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
		if len(alertState.Results) > 0 && alertState.State == eval.Alerting {
			valString = alertState.Results[0].EvaluationString
		}
		alertResponse.Data.Alerts = append(alertResponse.Data.Alerts, &apimodels.Alert{
			Labels:      map[string]string(alertState.Labels),
			Annotations: map[string]string{}, //TODO: Once annotations are added to the evaluation result, set them here
			State:       alertState.State.String(),
			ActiveAt:    &startsAt,
			Value:       valString,
		})
	}
	return response.JSON(http.StatusOK, alertResponse)
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

	ruleGroupQuery := ngmodels.ListOrgRuleGroupsQuery{
		OrgID: c.SignedInUser.OrgId,
	}
	if err := srv.store.GetOrgRuleGroups(&ruleGroupQuery); err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting rule groups: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
		return response.JSON(http.StatusInternalServerError, ruleResponse)
	}

	for _, r := range ruleGroupQuery.Result {
		if len(r) < 3 {
			continue
		}
		groupId, namespaceUID, namespace := r[0], r[1], r[2]
		if _, err := srv.store.GetNamespaceByUID(namespaceUID, c.SignedInUser.OrgId, c.SignedInUser); err != nil {
			if errors.Is(err, models.ErrFolderAccessDenied) {
				// do not include it in the response
				continue
			}
			return toNamespaceErrorResponse(err)
		}
		alertRuleQuery := ngmodels.ListRuleGroupAlertRulesQuery{OrgID: c.SignedInUser.OrgId, NamespaceUID: namespaceUID, RuleGroup: groupId}
		if err := srv.store.GetRuleGroupAlertRules(&alertRuleQuery); err != nil {
			ruleResponse.DiscoveryBase.Status = "error"
			ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting rules for group %s: %s", groupId, err.Error())
			ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
			return response.JSON(http.StatusInternalServerError, ruleResponse)
		}

		newGroup := &apimodels.RuleGroup{
			Name: groupId,
			// This doesn't make sense in our architecture
			// so we use this field for passing to the frontend the namespace
			File:           namespace,
			LastEvaluation: time.Time{},
			EvaluationTime: 0, // TODO: see if we are able to pass this along with evaluation results
		}

		for _, rule := range alertRuleQuery.Result {
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
				if len(alertState.Results) > 0 && alertState.State == eval.Alerting {
					valString = alertState.Results[0].EvaluationString
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
		ruleResponse.Data.RuleGroups = append(ruleResponse.Data.RuleGroups, newGroup)
	}
	return response.JSON(http.StatusOK, ruleResponse)
}
