package api

import (
	"fmt"
	"net/http"
	"time"

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
	log          log.Logger
	stateTracker *state.StateTracker
	store        store.RuleStore
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
	for _, alertState := range srv.stateTracker.GetAll() {
		startsAt := alertState.StartsAt
		alertResponse.Data.Alerts = append(alertResponse.Data.Alerts, &apimodels.Alert{
			Labels:      map[string]string(alertState.Labels),
			Annotations: map[string]string{}, //TODO: Once annotations are added to the evaluation result, set them here
			State:       alertState.State.String(),
			ActiveAt:    &startsAt,
			Value:       "", //TODO: once the result of the evaluation is added to the evaluation result, set it here
		})
	}
	return response.JSON(http.StatusOK, alertResponse)
}

func (srv PrometheusSrv) RouteGetRuleStatuses(c *models.ReqContext) response.Response {
	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{},
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
			instanceQuery := ngmodels.ListAlertInstancesQuery{
				DefinitionOrgID: c.SignedInUser.OrgId,
				DefinitionUID:   rule.UID,
			}
			if err := srv.store.ListAlertInstances(&instanceQuery); err != nil {
				ruleResponse.DiscoveryBase.Status = "error"
				ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting alerts for rule %s: %s", rule.UID, err.Error())
				ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
				return response.JSON(http.StatusInternalServerError, ruleResponse)
			}

			alertingRule := apimodels.AlertingRule{
				State:       "inactive",
				Name:        rule.Title,
				Query:       rule.DataToString(), // TODO: don't escape <>& etc
				Duration:    rule.For.Seconds(),
				Annotations: rule.Annotations,
			}

			newRule := apimodels.Rule{
				Name:           rule.Title,
				Labels:         nil,  // TODO: NG AlertRule does not have labels but does have annotations
				Health:         "ok", // TODO: update this in the future when error and noData states are being evaluated and set
				Type:           apiv1.RuleTypeAlerting,
				LastEvaluation: time.Time{}, // TODO: set this to be rule evaluation time once it is being set
				EvaluationTime: 0,           // TODO: set this once we are saving it or adding it to evaluation results
			}
			for _, instance := range instanceQuery.Result {
				activeAt := instance.CurrentStateSince
				alert := &apimodels.Alert{
					Labels:      map[string]string(instance.Labels),
					Annotations: nil, // TODO: set these once they are added to evaluation results
					State:       translateInstanceState(instance.CurrentState),
					ActiveAt:    &activeAt,
					Value:       "", // TODO: set this once it is added to the evaluation results
				}
				if instance.LastEvalTime.After(newRule.LastEvaluation) {
					newRule.LastEvaluation = instance.LastEvalTime
					newGroup.LastEvaluation = instance.LastEvalTime
				}
				switch alert.State {
				case "pending":
					if alertingRule.State == "inactive" {
						alertingRule.State = "pending"
					}
				case "firing":
					alertingRule.State = "firing"
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

func translateInstanceState(state ngmodels.InstanceStateType) string {
	switch {
	case state == ngmodels.InstanceStateFiring:
		return "firing"
	case state == ngmodels.InstanceStateNormal:
		return "inactive"
	case state == ngmodels.InstanceStatePending:
		return "pending"
	default:
		return "inactive"
	}
}
