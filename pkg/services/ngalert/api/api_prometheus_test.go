package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"

	. "github.com/grafana/grafana/pkg/services/ngalert/api/prometheus"
)

func Test_FormatValues(t *testing.T) {
	val1 := 1.1
	val2 := 1.4

	tc := []struct {
		name       string
		alertState *state.State
		expected   string
	}{
		{
			name: "with no value, it renders the evaluation string",
			alertState: &state.State{
				LastEvaluationString: "[ var='A' metric='vector(10) + time() % 50' labels={} value=1.1 ]",
				LatestResult:         &state.Evaluation{Condition: "A", Values: map[string]float64{}},
			},
			expected: "[ var='A' metric='vector(10) + time() % 50' labels={} value=1.1 ]",
		},
		{
			name: "with one value, it renders the single value",
			alertState: &state.State{
				LastEvaluationString: "[ var='A' metric='vector(10) + time() % 50' labels={} value=1.1 ]",
				LatestResult:         &state.Evaluation{Condition: "A", Values: map[string]float64{"A": val1}},
			},
			expected: "1.1e+00",
		},
		{
			name: "with two values, it renders the value based on their refID and position",
			alertState: &state.State{
				LastEvaluationString: "[ var='B0' metric='vector(10) + time() % 50' labels={} value=1.1 ], [ var='B1' metric='vector(10) + time() % 50' labels={} value=1.4 ]",
				LatestResult:         &state.Evaluation{Condition: "B", Values: map[string]float64{"B0": val1, "B1": val2}},
			},
			expected: "B0: 1.1e+00, B1: 1.4e+00",
		},
		{
			name: "with a high number of values, it renders the value based on their refID and position using a natural order",
			alertState: &state.State{
				LastEvaluationString: "[ var='B0' metric='vector(10) + time() % 50' labels={} value=1.1 ], [ var='B1' metric='vector(10) + time() % 50' labels={} value=1.4 ]",
				LatestResult:         &state.Evaluation{Condition: "B", Values: map[string]float64{"B0": val1, "B1": val2, "B2": val1, "B10": val2, "B11": val1}},
			},
			expected: "B0: 1.1e+00, B10: 1.4e+00, B11: 1.1e+00, B1: 1.4e+00, B2: 1.1e+00",
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, FormatValues(tt.alertState))
		})
	}
}

func TestRouteGetAlertStatuses(t *testing.T) {
	orgID := int64(1)

	t.Run("with no alerts", func(t *testing.T) {
		_, _, api := setupAPI(t)
		req, err := http.NewRequest("GET", "/api/v1/alerts", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID}}

		r := api.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"alerts": []
	}
}
`, string(r.Body()))
	})

	t.Run("with two alerts", func(t *testing.T) {
		_, fakeAIM, api := setupAPI(t)
		fakeAIM.GenerateAlertInstances(1, util.GenerateShortUID(), 2)
		req, err := http.NewRequest("GET", "/api/v1/alerts", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID}}

		r := api.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"alerts": [{
			"labels": {
				"alertname": "test_title_0",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Normal",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": ""
		}, {
			"labels": {
				"alertname": "test_title_1",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Normal",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": ""
		}]
	}
}`, string(r.Body()))
	})

	t.Run("with two firing alerts", func(t *testing.T) {
		_, fakeAIM, api := setupAPI(t)
		fakeAIM.GenerateAlertInstances(1, util.GenerateShortUID(), 2, withAlertingState())
		req, err := http.NewRequest("GET", "/api/v1/alerts", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID}}

		r := api.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"alerts": [{
			"labels": {
				"alertname": "test_title_0",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Alerting",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": "1.1e+00"
		}, {
			"labels": {
				"alertname": "test_title_1",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Alerting",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": "1.1e+00"
		}]
	}
}`, string(r.Body()))
	})

	t.Run("with a recovering alert", func(t *testing.T) {
		_, fakeAIM, api := setupAPI(t)
		fakeAIM.GenerateAlertInstances(1, util.GenerateShortUID(), 1, withRecoveringState())
		req, err := http.NewRequest("GET", "/api/v1/alerts", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID}}

		r := api.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
			{
				"status": "success",
				"data": {
					"alerts": [{
						"labels": {
							"alertname": "test_title_0",
							"instance_label": "test",
							"label": "test"
						},
						"annotations": {
							"annotation": "test"
						},
						"state": "Recovering",
						"activeAt": "0001-01-01T00:00:00Z",
						"value": "1.1e+00"
					}]
				}
			}`,
			string(r.Body()),
		)
	})

	t.Run("with the inclusion of internal labels", func(t *testing.T) {
		_, fakeAIM, api := setupAPI(t)
		fakeAIM.GenerateAlertInstances(orgID, util.GenerateShortUID(), 2)
		req, err := http.NewRequest("GET", "/api/v1/alerts?includeInternalLabels=true", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID}}

		r := api.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"alerts": [{
			"labels": {
				"__alert_rule_namespace_uid__": "test_namespace_uid",
				"__alert_rule_uid__": "test_alert_rule_uid_0",
				"alertname": "test_title_0",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Normal",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": ""
		}, {
			"labels": {
				"__alert_rule_namespace_uid__": "test_namespace_uid",
				"__alert_rule_uid__": "test_alert_rule_uid_1",
				"alertname": "test_title_1",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Normal",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": ""
		}]
	}
}`, string(r.Body()))
	})
}

func withAlertingState() forEachState {
	return func(s *state.State) *state.State {
		s.State = eval.Alerting
		s.LatestResult = &state.Evaluation{
			EvaluationState: eval.Alerting,
			EvaluationTime:  timeNow(),
			Values:          map[string]float64{"B": float64(1.1)},
			Condition:       "B",
		}
		return s
	}
}

func withRecoveringState() forEachState {
	return func(s *state.State) *state.State {
		s.State = eval.Recovering
		s.LatestResult = &state.Evaluation{
			EvaluationState: eval.Alerting,
			EvaluationTime:  timeNow(),
			Values:          map[string]float64{"B": float64(1.1)},
			Condition:       "B",
		}
		return s
	}
}

func withAlertingErrorState() forEachState {
	return func(s *state.State) *state.State {
		s.SetAlerting("", timeNow(), timeNow().Add(5*time.Minute))
		s.Error = errors.New("this is an error")
		return s
	}
}

func withErrorState() forEachState {
	return func(s *state.State) *state.State {
		s.SetError(errors.New("this is an error"), timeNow(), timeNow().Add(5*time.Minute))
		return s
	}
}

func withNoDataState() forEachState {
	return func(s *state.State) *state.State {
		s.SetNoData("no data returned", timeNow(), timeNow().Add(5*time.Minute))
		return s
	}
}

func withLabels(labels data.Labels) forEachState {
	return func(s *state.State) *state.State {
		for k, v := range labels {
			s.Labels[k] = v
		}
		return s
	}
}

func TestRouteGetRuleStatuses(t *testing.T) {
	timeNow = func() time.Time { return time.Date(2022, 3, 10, 14, 0, 0, 0, time.UTC) }
	orgID := int64(1)
	gen := ngmodels.RuleGen
	gen = gen.With(gen.WithOrgID(orgID))
	queryPermissions := map[int64]map[string][]string{1: {datasources.ActionQuery: {datasources.ScopeAll}}}

	req, err := http.NewRequest("GET", "/api/v1/rules", nil)
	require.NoError(t, err)
	c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID, Permissions: queryPermissions}}

	t.Run("with no rules", func(t *testing.T) {
		_, _, api := setupAPI(t)
		r := api.RouteGetRuleStatuses(c)

		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"groups": []
	}
}
`, string(r.Body()))
	})

	t.Run("with a rule that only has one query", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(), gen.WithNoNotificationSettings(), gen.WithIsPaused(false))
		folder := fakeStore.Folders[orgID][0]

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "%s",
			"folderUid": "namespaceUID",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"folderUid": "namespaceUID",
				"uid": "RuleUID",
				"query": "vector(1)",
				"queriedDatasourceUIDs": ["AUID"],
				"alerts": [{
					"labels": {
						"job": "prometheus"
					},
					"annotations": {
						"severity": "critical"
					},
					"state": "Normal",
					"activeAt": "0001-01-01T00:00:00Z",
					"value": ""
				}],
				"totals": {
					"normal": 1
				},
				"totalsFiltered": {
					"normal": 1
				},
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
				"keepFiringFor": 10,
				"evaluationTime": 60
			}],
			"totals": {
				"inactive": 1
			},
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 60
		}],
		"totals": {
			"inactive": 1
		}
	}
}
`, folder.Fullpath), string(r.Body()))
	})

	t.Run("with a rule that is paused", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(), gen.WithNoNotificationSettings(), gen.WithIsPaused(true))
		folder := fakeStore.Folders[orgID][0]

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "%s",
			"folderUid": "namespaceUID",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"folderUid": "namespaceUID",
				"uid": "RuleUID",
				"query": "vector(1)",
				"queriedDatasourceUIDs": ["AUID"],
				"alerts": [{
					"labels": {
						"job": "prometheus"
					},
					"annotations": {
						"severity": "critical"
					},
					"state": "Normal",
					"activeAt": "0001-01-01T00:00:00Z",
					"value": ""
				}],
				"totals": {
					"normal": 1
				},
				"totalsFiltered": {
					"normal": 1
				},
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"isPaused": true,
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
				"keepFiringFor": 10,
				"evaluationTime": 60
			}],
			"totals": {
				"inactive": 1
			},
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 60
		}],
		"totals": {
			"inactive": 1
		}
	}
}
`, folder.Fullpath), string(r.Body()))
	})

	t.Run("with a rule that has notification settings", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		notificationSettings := ngmodels.NotificationSettings{
			Receiver: "test-receiver",
			GroupBy:  []string{"job"},
		}
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(), gen.WithNotificationSettings(notificationSettings), gen.WithIsPaused(false))
		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		var res apimodels.RuleResponse
		require.NoError(t, json.Unmarshal(r.Body(), &res))
		require.Len(t, res.Data.RuleGroups, 1)
		require.Len(t, res.Data.RuleGroups[0].Rules, 1)
		require.NotNil(t, res.Data.RuleGroups[0].Rules[0].NotificationSettings)
		require.Equal(t, notificationSettings.Receiver, res.Data.RuleGroups[0].Rules[0].NotificationSettings.Receiver)
	})

	t.Run("with the inclusion of internal Labels", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(), gen.WithNoNotificationSettings(), gen.WithIsPaused(false))
		folder := fakeStore.Folders[orgID][0]

		req, err := http.NewRequest("GET", "/api/v1/rules?includeInternalLabels=true", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID, Permissions: queryPermissions}}

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "%s",
			"folderUid": "namespaceUID",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "vector(1)",
				"queriedDatasourceUIDs": ["AUID"],
				"folderUid": "namespaceUID",
				"uid": "RuleUID",
				"alerts": [{
					"labels": {
						"job": "prometheus",
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__": "test_alert_rule_uid_0"
					},
					"annotations": {
						"severity": "critical"
					},
					"state": "Normal",
					"activeAt": "0001-01-01T00:00:00Z",
					"value": ""
				}],
				"totals": {
					"normal": 1
				},
				"totalsFiltered": {
					"normal": 1
				},
				"labels": {
					"__a_private_label_on_the_rule__": "a_value",
					"__alert_rule_uid__": "RuleUID"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
				"keepFiringFor": 10,
				"evaluationTime": 60
			}],
			"totals": {
				"inactive": 1
			},
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 60
		}],
		"totals": {
			"inactive": 1
		}
	}
}
`, folder.Fullpath), string(r.Body()))
	})

	t.Run("with a rule that has multiple queries", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withExpressionsMultiQuery(), gen.WithNoNotificationSettings(), gen.WithIsPaused(false))
		folder := fakeStore.Folders[orgID][0]

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "%s",
			"folderUid": "namespaceUID",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "vector(1) | vector(1)",
				"queriedDatasourceUIDs": ["AUID", "BUID"],
				"folderUid": "namespaceUID",
				"uid": "RuleUID",
				"alerts": [{
					"labels": {
						"job": "prometheus"
					},
					"annotations": {
						"severity": "critical"
					},
					"state": "Normal",
					"activeAt": "0001-01-01T00:00:00Z",
					"value": ""
				}],
				"totals": {
					"normal": 1
				},
				"totalsFiltered": {
					"normal": 1
				},
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
				"keepFiringFor": 10,
				"evaluationTime": 60
			}],
			"totals": {
				"inactive": 1
			},
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 60
		}],
		"totals": {
			"inactive": 1
		}
	}
}
`, folder.Fullpath), string(r.Body()))
	})

	t.Run("with a recovering alert", func(t *testing.T) {
		gen := ngmodels.RuleGen

		t.Run("when it is the only alert", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)
			rule := gen.With(gen.WithOrgID(orgID), asFixture(), withClassicConditionSingleQuery()).GenerateRef()
			fakeAIM.GenerateAlertInstances(1, rule.UID, 1, withRecoveringState())
			fakeStore.PutRule(context.Background(), rule)

			r := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, r.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(r.Body(), &res))

			// There should be 1 recovering rule
			require.Equal(t, map[string]int64{"recovering": 1}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Equal(t, "recovering", rg.Rules[0].State)

			// The rule should have one recovering alert
			require.Equal(t, map[string]int64{"recovering": 1}, rg.Rules[0].Totals)
			require.Equal(t, map[string]int64{"recovering": 1}, rg.Rules[0].TotalsFiltered)
			require.Len(t, rg.Rules[0].Alerts, 1)
			require.Equal(t, "Recovering", rg.Rules[0].Alerts[0].State)
		})

		t.Run("when the rule has also a firing alert", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)
			rule := gen.With(gen.WithOrgID(orgID), asFixture(), withClassicConditionSingleQuery()).GenerateRef()
			fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, withRecoveringState())
			fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, withAlertingState())
			fakeStore.PutRule(context.Background(), rule)

			r := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, r.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(r.Body(), &res))

			// There should be 1 firing rule
			require.Equal(t, map[string]int64{"firing": 1}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Equal(t, "firing", rg.Rules[0].State)

			// The rule should have one firing and one recovering alert
			require.Equal(t, map[string]int64{"alerting": 1, "recovering": 1}, rg.Rules[0].Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "recovering": 1}, rg.Rules[0].TotalsFiltered)
			require.Len(t, rg.Rules[0].Alerts, 2)
			alertStates := []string{rg.Rules[0].Alerts[0].State, rg.Rules[0].Alerts[1].State}
			require.ElementsMatch(t, alertStates, []string{"Alerting", "Recovering"})
		})

		t.Run("filtered by recovering state", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)
			groupKey := ngmodels.GenerateGroupKey(orgID)
			recoveringRule := gen.With(gen.WithOrgID(orgID), gen.WithGroupKey(groupKey), withClassicConditionSingleQuery()).GenerateRef()
			alertingRule := gen.With(gen.WithOrgID(orgID), gen.WithGroupKey(groupKey), withClassicConditionSingleQuery()).GenerateRef()
			fakeAIM.GenerateAlertInstances(orgID, recoveringRule.UID, 1, withRecoveringState())
			fakeAIM.GenerateAlertInstances(orgID, alertingRule.UID, 1, withAlertingState())
			fakeStore.PutRule(context.Background(), recoveringRule)
			fakeStore.PutRule(context.Background(), alertingRule)

			req, err := http.NewRequest("GET", "/api/v1/rules?state=recovering", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			r := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, r.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(r.Body(), &res))

			// global totals aren't filtered
			require.Equal(t, map[string]int64{"recovering": 1, "firing": 1}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Equal(t, "recovering", rg.Rules[0].State)

			// The rule should have one recovering alert
			require.Equal(t, map[string]int64{"recovering": 1}, rg.Rules[0].Totals)
			require.Equal(t, map[string]int64{"recovering": 1}, rg.Rules[0].TotalsFiltered)
			require.Len(t, rg.Rules[0].Alerts, 1)
			require.Equal(t, "Recovering", rg.Rules[0].Alerts[0].State)
		})
	})

	t.Run("with many rules in a group", func(t *testing.T) {
		t.Run("should return sorted", func(t *testing.T) {
			ruleStore := fakes.NewRuleStore(t)
			fakeAIM := NewFakeAlertInstanceManager(t)
			fakeSch := newFakeSchedulerReader(t).setupStates(fakeAIM)
			groupKey := ngmodels.GenerateGroupKey(orgID)
			gen := ngmodels.RuleGen
			rules := gen.With(gen.WithGroupKey(groupKey), gen.WithUniqueGroupIndex()).GenerateManyRef(5, 10)
			ruleStore.PutRule(context.Background(), rules...)

			api := NewPrometheusSrv(
				log.NewNopLogger(),
				fakeAIM,
				fakeSch,
				ruleStore,
				&fakeRuleAccessControlService{},
				fakes.NewFakeProvisioningStore(),
			)

			response := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, response.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(response.Body(), result))

			ngmodels.RulesGroup(rules).SortByGroupIndex()

			require.Len(t, result.Data.RuleGroups, 1)
			group := result.Data.RuleGroups[0]
			require.Equal(t, groupKey.RuleGroup, group.Name)
			require.Len(t, group.Rules, len(rules))
			for i, actual := range group.Rules {
				expected := rules[i]
				if actual.Name != expected.Title {
					var actualNames []string
					var expectedNames []string
					for _, rule := range group.Rules {
						actualNames = append(actualNames, rule.Name)
					}
					for _, rule := range rules {
						expectedNames = append(expectedNames, rule.Title)
					}
					require.Fail(t, fmt.Sprintf("rules are not sorted by group index. Expected: %v. Actual: %v", expectedNames, actualNames))
				}
			}
		})
	})

	t.Run("test folder, group and rule name query params", func(t *testing.T) {
		ruleStore := fakes.NewRuleStore(t)
		fakeAIM := NewFakeAlertInstanceManager(t)

		rulesInGroup1 := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			RuleGroup:    "rule-group-1",
			NamespaceUID: "folder-1",
			OrgID:        orgID,
		})).GenerateManyRef(1)

		rulesInGroup2 := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			RuleGroup:    "rule-group-2",
			NamespaceUID: "folder-2",
			OrgID:        orgID,
		})).GenerateManyRef(2)

		rulesInGroup3 := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			RuleGroup:    "rule-group-3",
			NamespaceUID: "folder-1",
			OrgID:        orgID,
		})).GenerateManyRef(3)

		ruleStore.PutRule(context.Background(), rulesInGroup1...)
		ruleStore.PutRule(context.Background(), rulesInGroup2...)
		ruleStore.PutRule(context.Background(), rulesInGroup3...)

		api := NewPrometheusSrv(
			log.NewNopLogger(),
			fakeAIM,
			newFakeSchedulerReader(t).setupStates(fakeAIM),
			ruleStore,
			accesscontrol.NewRuleService(acimpl.ProvideAccessControl(featuremgmt.WithFeatures())),
			fakes.NewFakeProvisioningStore(),
		)

		permissions := createPermissionsForRules(slices.Concat(rulesInGroup1, rulesInGroup2, rulesInGroup3), orgID)
		user := &user.SignedInUser{
			OrgID:       orgID,
			Permissions: permissions,
		}
		c := &contextmodel.ReqContext{
			SignedInUser: user,
		}
		t.Run("should only return rule groups under given folder_uid", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?folder_uid=folder-1", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2)
			require.Equal(t, "rule-group-1", result.Data.RuleGroups[0].Name)
			require.Equal(t, "rule-group-3", result.Data.RuleGroups[1].Name)
		})

		t.Run("should only return rule groups under given rule_group list", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?rule_group=rule-group-1&rule_group=rule-group-2", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2)
			require.True(t, true, slices.ContainsFunc(result.Data.RuleGroups, func(rg apimodels.RuleGroup) bool {
				return rg.Name == "rule-group-1"
			}))
			require.True(t, true, slices.ContainsFunc(result.Data.RuleGroups, func(rg apimodels.RuleGroup) bool {
				return rg.Name == "rule-group-2"
			}))
		})

		t.Run("should only return rule under given rule_name list", func(t *testing.T) {
			expectedRuleInGroup2 := rulesInGroup2[0]
			expectedRuleInGroup3 := rulesInGroup3[0]

			r, err := http.NewRequest("GET", fmt.Sprintf("/api/v1/rules?rule_name=%s&rule_name=%s", expectedRuleInGroup2.Title, expectedRuleInGroup3.Title), nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2)
			require.True(t, true, slices.ContainsFunc(result.Data.RuleGroups, func(rg apimodels.RuleGroup) bool {
				return rg.Name == "rule-group-2"
			}))
			require.True(t, true, slices.ContainsFunc(result.Data.RuleGroups, func(rg apimodels.RuleGroup) bool {
				return rg.Name == "rule-group-3"
			}))
			require.Len(t, result.Data.RuleGroups[0].Rules, 1)
			require.Len(t, result.Data.RuleGroups[1].Rules, 1)

			if result.Data.RuleGroups[0].Name == "rule-group-2" {
				require.Equal(t, expectedRuleInGroup2.Title, result.Data.RuleGroups[0].Rules[0].Name)
				require.Equal(t, expectedRuleInGroup3.Title, result.Data.RuleGroups[1].Rules[0].Name)
			} else {
				require.Equal(t, expectedRuleInGroup2.Title, result.Data.RuleGroups[1].Rules[0].Name)
				require.Equal(t, expectedRuleInGroup3.Title, result.Data.RuleGroups[0].Rules[0].Name)
			}
		})

		t.Run("should only return rule with given folder_uid, rule_group and rule_name", func(t *testing.T) {
			expectedRule := rulesInGroup3[2]
			r, err := http.NewRequest("GET", fmt.Sprintf("/api/v1/rules?folder_uid=folder-1&rule_group=rule-group-3&rule_name=%s", expectedRule.Title), nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 1)
			folder, err := ruleStore.GetNamespaceByUID(context.Background(), "folder-1", orgID, user)
			require.NoError(t, err)
			require.Equal(t, folder.Fullpath, result.Data.RuleGroups[0].File)
			require.Equal(t, "rule-group-3", result.Data.RuleGroups[0].Name)
			require.Len(t, result.Data.RuleGroups[0].Rules, 1)
			require.Equal(t, expectedRule.Title, result.Data.RuleGroups[0].Rules[0].Name)
		})
	})

	t.Run("when requesting rules with pagination", func(t *testing.T) {
		ruleStore := fakes.NewRuleStore(t)
		fakeAIM := NewFakeAlertInstanceManager(t)

		// Generate 9 rule groups across 3 namespaces
		// Added in reverse order so we can check that
		// they are sorted when returned
		allRules := make([]*ngmodels.AlertRule, 0, 9)
		for i := 8; i >= 0; i-- {
			rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
				RuleGroup:    fmt.Sprintf("rule_group_%d", i),
				NamespaceUID: fmt.Sprintf("namespace_%d", i/9),
				OrgID:        orgID,
			})).GenerateManyRef(1)

			allRules = append(allRules, rules...)
			ruleStore.PutRule(context.Background(), rules...)
		}

		api := NewPrometheusSrv(
			log.NewNopLogger(),
			fakeAIM,
			newFakeSchedulerReader(t).setupStates(fakeAIM),
			ruleStore,
			accesscontrol.NewRuleService(acimpl.ProvideAccessControl(featuremgmt.WithFeatures())),
			fakes.NewFakeProvisioningStore(),
		)

		permissions := createPermissionsForRules(allRules, orgID)
		user := &user.SignedInUser{
			OrgID:       orgID,
			Permissions: permissions,
		}
		c := &contextmodel.ReqContext{
			SignedInUser: user,
		}

		t.Run("should return all groups when not specifying max_groups query param", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 9)
			require.NotZero(t, len(result.Data.Totals))
			for i := 0; i < 9; i++ {
				folder, err := ruleStore.GetNamespaceByUID(context.Background(), fmt.Sprintf("namespace_%d", i/9), orgID, user)
				require.NoError(t, err)
				require.Equal(t, folder.Fullpath, result.Data.RuleGroups[i].File)
				require.Equal(t, fmt.Sprintf("rule_group_%d", i), result.Data.RuleGroups[i].Name)
			}
		})

		t.Run("should return group_limit number of groups in each call", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?group_limit=2", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			returnedGroups := make([]apimodels.RuleGroup, 0, len(allRules))

			require.Len(t, result.Data.RuleGroups, 2)
			require.Len(t, result.Data.Totals, 0)
			returnedGroups = append(returnedGroups, result.Data.RuleGroups...)
			require.NotEmpty(t, result.Data.NextToken)
			token := result.Data.NextToken

			for i := 0; i < 3; i++ {
				r, err := http.NewRequest("GET", fmt.Sprintf("/api/v1/rules?group_limit=2&group_next_token=%s", token), nil)
				require.NoError(t, err)

				c.Context = &web.Context{Req: r}

				resp := api.RouteGetRuleStatuses(c)
				require.Equal(t, http.StatusOK, resp.Status())
				result := &apimodels.RuleResponse{}
				require.NoError(t, json.Unmarshal(resp.Body(), result))

				require.Len(t, result.Data.RuleGroups, 2)
				require.Len(t, result.Data.Totals, 0)
				returnedGroups = append(returnedGroups, result.Data.RuleGroups...)
				require.NotEmpty(t, result.Data.NextToken)
				token = result.Data.NextToken
			}

			// Final page should only return a single group and no token
			r, err = http.NewRequest("GET", fmt.Sprintf("/api/v1/rules?group_limit=2&group_next_token=%s", token), nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp = api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result = &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 1)
			require.Len(t, result.Data.Totals, 0)
			returnedGroups = append(returnedGroups, result.Data.RuleGroups...)
			require.Empty(t, result.Data.NextToken)

			for i := 0; i < 9; i++ {
				folder, err := ruleStore.GetNamespaceByUID(context.Background(), fmt.Sprintf("namespace_%d", i/9), orgID, user)
				require.NoError(t, err)
				require.Equal(t, folder.Fullpath, returnedGroups[i].File)
				require.Equal(t, fmt.Sprintf("rule_group_%d", i), returnedGroups[i].Name)
			}
		})

		t.Run("bad token should return first group_limit results", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?group_limit=1&group_next_token=foobar", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 1)
			require.Len(t, result.Data.Totals, 0)
			require.NotEmpty(t, result.Data.NextToken)

			folder, err := ruleStore.GetNamespaceByUID(context.Background(), "namespace_0", orgID, user)
			require.NoError(t, err)
			require.Equal(t, folder.Fullpath, result.Data.RuleGroups[0].File)
			require.Equal(t, "rule_group_0", result.Data.RuleGroups[0].Name)
		})

		t.Run("should return nothing when using group_limit=0", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?group_limit=0", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 0)
		})
	})

	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		t.Run("should return only rules if the user can query all data sources", func(t *testing.T) {
			ruleStore := fakes.NewRuleStore(t)
			fakeAIM := NewFakeAlertInstanceManager(t)

			rules := gen.GenerateManyRef(2, 6)
			ruleStore.PutRule(context.Background(), rules...)
			ruleStore.PutRule(context.Background(), gen.GenerateManyRef(2, 6)...)

			api := NewPrometheusSrv(
				log.NewNopLogger(),
				fakeAIM,
				newFakeSchedulerReader(t).setupStates(fakeAIM),
				ruleStore,
				accesscontrol.NewRuleService(acimpl.ProvideAccessControl(featuremgmt.WithFeatures())),
				fakes.NewFakeProvisioningStore(),
			)

			c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID, Permissions: createPermissionsForRules(rules, orgID)}}

			response := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, response.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(response.Body(), result))
			for _, group := range result.Data.RuleGroups {
			grouploop:
				for _, rule := range group.Rules {
					for i, expected := range rules {
						if rule.Name == expected.Title && group.Name == expected.RuleGroup {
							rules = append(rules[:i], rules[i+1:]...)
							continue grouploop
						}
					}
					assert.Failf(t, "rule %s in a group %s was not found in expected", rule.Name, group.Name)
				}
			}
			assert.Emptyf(t, rules, "not all expected rules were returned")
		})
	})

	t.Run("test totals are expected", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		// Create rules in the same Rule Group to keep assertions simple
		rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			RuleGroup:    "Rule-Group-1",
			NamespaceUID: "Folder-1",
			OrgID:        orgID,
		})).GenerateManyRef(3)
		// Need to sort these so we add alerts to the rules as ordered in the response
		ngmodels.AlertRulesBy(ngmodels.AlertRulesByIndex).Sort(rules)
		// The last two rules will have errors, however the first will be alerting
		// while the second one will have a DatasourceError alert.
		rules[1].ExecErrState = ngmodels.AlertingErrState
		rules[2].ExecErrState = ngmodels.ErrorErrState
		fakeStore.PutRule(context.Background(), rules...)

		// create a normal and alerting state for the first rule
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1)
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, withAlertingState())
		// create an error state for the last two rules
		fakeAIM.GenerateAlertInstances(orgID, rules[1].UID, 1, withAlertingErrorState())
		fakeAIM.GenerateAlertInstances(orgID, rules[2].UID, 1, withErrorState())

		r, err := http.NewRequest("GET", "/api/v1/rules", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{
			Context: &web.Context{Req: r},
			SignedInUser: &user.SignedInUser{
				OrgID:       orgID,
				Permissions: queryPermissions,
			},
		}
		resp := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, resp.Status())
		var res apimodels.RuleResponse
		require.NoError(t, json.Unmarshal(resp.Body(), &res))

		// Even though there are just 3 rules, the totals should show two firing rules,
		// one inactive rules and two errors
		require.Equal(t, map[string]int64{"firing": 2, "inactive": 1, "error": 2}, res.Data.Totals)
		// There should be 1 Rule Group that contains all rules
		require.Len(t, res.Data.RuleGroups, 1)
		rg := res.Data.RuleGroups[0]
		require.Len(t, rg.Rules, 3)

		// The first rule should have an alerting and normal alert
		r1 := rg.Rules[0]
		require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, r1.Totals)
		require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, r1.TotalsFiltered)
		require.Len(t, r1.Alerts, 2)
		// The second rule should have an alerting alert
		r2 := rg.Rules[1]
		require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, r2.Totals)
		require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, r2.TotalsFiltered)
		require.Len(t, r2.Alerts, 1)
		// The last rule should have an error alert
		r3 := rg.Rules[2]
		require.Equal(t, map[string]int64{"error": 1}, r3.Totals)
		require.Equal(t, map[string]int64{"error": 1}, r3.TotalsFiltered)
		require.Len(t, r3.Alerts, 1)
	})

	t.Run("test time of first firing alert", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		// Create rules in the same Rule Group to keep assertions simple
		rules := gen.GenerateManyRef(1)
		fakeStore.PutRule(context.Background(), rules...)

		getRuleResponse := func() apimodels.RuleResponse {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			return res
		}

		// no alerts so timestamp should be nil
		res := getRuleResponse()
		require.Len(t, res.Data.RuleGroups, 1)
		rg := res.Data.RuleGroups[0]
		require.Len(t, rg.Rules, 1)
		require.Nil(t, rg.Rules[0].ActiveAt)

		// create a normal alert, the timestamp should still be nil
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1)
		res = getRuleResponse()
		require.Len(t, res.Data.RuleGroups, 1)
		rg = res.Data.RuleGroups[0]
		require.Len(t, rg.Rules, 1)
		require.Nil(t, rg.Rules[0].ActiveAt)

		// create a firing alert, the timestamp should be non-nil
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, withAlertingState())
		res = getRuleResponse()
		require.Len(t, res.Data.RuleGroups, 1)
		rg = res.Data.RuleGroups[0]
		require.Len(t, rg.Rules, 1)
		require.NotNil(t, rg.Rules[0].ActiveAt)

		lastActiveAt := rg.Rules[0].ActiveAt
		// create a second firing alert, the timestamp of first firing alert should be the same
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, withAlertingState())
		res = getRuleResponse()
		require.Len(t, res.Data.RuleGroups, 1)
		rg = res.Data.RuleGroups[0]
		require.Len(t, rg.Rules, 1)
		require.Equal(t, lastActiveAt, rg.Rules[0].ActiveAt)
	})

	t.Run("test with limit on Rule Groups", func(t *testing.T) {
		fakeStore, _, api := setupAPI(t)

		rules := gen.GenerateManyRef(2)
		fakeStore.PutRule(context.Background(), rules...)

		t.Run("first without limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 inactive rules across all Rule Groups
			require.Equal(t, map[string]int64{"inactive": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 2)
			for _, rg := range res.Data.RuleGroups {
				// Each Rule Group should have 1 inactive rule
				require.Equal(t, map[string]int64{"inactive": 1}, rg.Totals)
				require.Len(t, rg.Rules, 1)
			}
		})
	})

	t.Run("test with limit rules", func(t *testing.T) {
		fakeStore, _, api := setupAPI(t)
		rules := gen.With(gen.WithGroupName("Rule-Group-1")).GenerateManyRef(2)
		fakeStore.PutRule(context.Background(), rules...)

		t.Run("first without limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 inactive rules across all Rule Groups
			require.Equal(t, map[string]int64{"inactive": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 2)
			for _, rg := range res.Data.RuleGroups {
				// Each Rule Group should have 1 inactive rule
				require.Equal(t, map[string]int64{"inactive": 1}, rg.Totals)
				require.Len(t, rg.Rules, 1)
			}
		})

		t.Run("then with limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?limit_rules=1", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 inactive rules
			require.Equal(t, map[string]int64{"inactive": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 2)
			// The Rule Groups should have 1 inactive rule because of the limit
			rg1 := res.Data.RuleGroups[0]
			require.Equal(t, map[string]int64{"inactive": 1}, rg1.Totals)
			require.Len(t, rg1.Rules, 1)
			rg2 := res.Data.RuleGroups[1]
			require.Equal(t, map[string]int64{"inactive": 1}, rg2.Totals)
			require.Len(t, rg2.Rules, 1)
		})

		t.Run("then with limit larger than number of rules", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?limit_rules=2", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Len(t, res.Data.RuleGroups, 2)
			require.Len(t, res.Data.RuleGroups[0].Rules, 1)
			require.Len(t, res.Data.RuleGroups[1].Rules, 1)
		})
	})

	t.Run("test with limit alerts", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		rules := gen.With(gen.WithGroupName("Rule-Group-1")).GenerateManyRef(2)
		fakeStore.PutRule(context.Background(), rules...)
		// create a normal and firing alert for each rule
		for _, r := range rules {
			fakeAIM.GenerateAlertInstances(orgID, r.UID, 1)
			fakeAIM.GenerateAlertInstances(orgID, r.UID, 1, withAlertingState())
		}

		t.Run("first without limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 firing rules across all Rule Groups
			require.Equal(t, map[string]int64{"firing": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 2)
			for _, rg := range res.Data.RuleGroups {
				// Each Rule Group should have 1 firing rule
				require.Equal(t, map[string]int64{"firing": 1}, rg.Totals)
				require.Len(t, rg.Rules, 1)
				// Each rule should have two alerts
				require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].Totals)
				require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].TotalsFiltered)
			}
		})

		t.Run("then with limits", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?limit_rules=1&limit_alerts=1", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 firing rules across all Rule Groups
			require.Equal(t, map[string]int64{"firing": 2}, res.Data.Totals)
			rg := res.Data.RuleGroups[0]
			// The Rule Group within the limit should have 1 inactive rule because of the limit
			require.Equal(t, map[string]int64{"firing": 1}, rg.Totals)
			require.Len(t, rg.Rules, 1)
			rule := rg.Rules[0]
			// The rule should have two alerts, but just one should be returned
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rule.Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rule.TotalsFiltered)
			require.Len(t, rule.Alerts, 1)
			// Firing alerts should have precedence over normal alerts
			require.Equal(t, "Alerting", rule.Alerts[0].State)
		})

		t.Run("then with limit larger than number of alerts", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?limit_rules=1&limit_alerts=3", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Len(t, res.Data.RuleGroups, 2)
			require.Len(t, res.Data.RuleGroups[0].Rules, 1)
			require.Len(t, res.Data.RuleGroups[0].Rules[0].Alerts, 2)
			require.Len(t, res.Data.RuleGroups[1].Rules, 1)
			require.Len(t, res.Data.RuleGroups[1].Rules[0].Alerts, 2)
		})
	})

	t.Run("test with filters on state", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		// create rules in the same Rule Group to keep assertions simple
		rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			NamespaceUID: "Folder-1",
			RuleGroup:    "Rule-Group-1",
			OrgID:        orgID,
		})).GenerateManyRef(3)
		// Need to sort these so we add alerts to the rules as ordered in the response
		ngmodels.AlertRulesBy(ngmodels.AlertRulesByIndex).Sort(rules)
		// The last two rules will have errors, however the first will be alerting
		// while the second one will have a DatasourceError alert.
		rules[1].ExecErrState = ngmodels.AlertingErrState
		rules[2].ExecErrState = ngmodels.ErrorErrState
		fakeStore.PutRule(context.Background(), rules...)

		// create a normal and alerting state for the first rule
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1)
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, withAlertingState())
		// create an error state for the last two rules
		fakeAIM.GenerateAlertInstances(orgID, rules[1].UID, 1, withAlertingErrorState())
		fakeAIM.GenerateAlertInstances(orgID, rules[2].UID, 1, withErrorState())

		t.Run("invalid state returns 400 Bad Request", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?state=unknown", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusBadRequest, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Equal(t, "unknown state 'unknown'", res.Error)
		})

		t.Run("first without filters", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 firing rules, 1 inactive rule, and 2 with errors
			require.Equal(t, map[string]int64{"firing": 2, "inactive": 1, "error": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 3)

			// The first two rules should be firing and the last should be inactive
			require.Equal(t, "firing", rg.Rules[0].State)
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].TotalsFiltered)
			require.Len(t, rg.Rules[0].Alerts, 2)
			require.Equal(t, "firing", rg.Rules[1].State)
			require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, rg.Rules[1].Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, rg.Rules[1].TotalsFiltered)
			require.Len(t, rg.Rules[1].Alerts, 1)
			require.Equal(t, "inactive", rg.Rules[2].State)
			require.Equal(t, map[string]int64{"error": 1}, rg.Rules[2].Totals)
			require.Equal(t, map[string]int64{"error": 1}, rg.Rules[2].TotalsFiltered)
			require.Len(t, rg.Rules[2].Alerts, 1)
		})

		t.Run("then with filter for firing alerts", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?state=firing", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// The totals should be the same
			require.Equal(t, map[string]int64{"firing": 2, "inactive": 1, "error": 2}, res.Data.Totals)

			// The inactive rules should be filtered out of the result
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 2)

			// Both firing rules should be returned with their totals unchanged
			require.Equal(t, "firing", rg.Rules[0].State)
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].Totals)

			// After filtering the totals for normal are no longer included.
			require.Equal(t, map[string]int64{"alerting": 1}, rg.Rules[0].TotalsFiltered)
			// The first rule should have just 1 firing alert as the inactive alert
			// has been removed by the filter for firing alerts
			require.Len(t, rg.Rules[0].Alerts, 1)

			require.Equal(t, "firing", rg.Rules[1].State)
			require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, rg.Rules[1].Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, rg.Rules[1].TotalsFiltered)
			require.Len(t, rg.Rules[1].Alerts, 1)
		})

		t.Run("then with filters for both inactive and firing alerts", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?state=inactive&state=firing", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// The totals should be the same
			require.Equal(t, map[string]int64{"firing": 2, "inactive": 1, "error": 2}, res.Data.Totals)

			// The number of rules returned should also be the same
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 3)

			// The first two rules should be firing and the last should be inactive
			require.Equal(t, "firing", rg.Rules[0].State)
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "normal": 1}, rg.Rules[0].TotalsFiltered)
			require.Len(t, rg.Rules[0].Alerts, 2)
			require.Equal(t, "firing", rg.Rules[1].State)
			require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, rg.Rules[1].Totals)
			require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, rg.Rules[1].TotalsFiltered)
			require.Len(t, rg.Rules[1].Alerts, 1)

			// The last rule should have 1 alert.
			require.Equal(t, "inactive", rg.Rules[2].State)
			require.Equal(t, map[string]int64{"error": 1}, rg.Rules[2].Totals)

			// The TotalsFiltered for error will be 0 out as the state filter does not include error.
			require.Empty(t, rg.Rules[2].TotalsFiltered)
			// The error alert has been removed as the filters are inactive and firing
			require.Len(t, rg.Rules[2].Alerts, 0)
		})

		t.Run("then with all rules filtered out, no groups returned", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=unknown", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 0)
		})
	})

	t.Run("test with filters on health", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			NamespaceUID: "Folder-1",
			RuleGroup:    "Rule-Group-1",
			OrgID:        orgID,
		})).GenerateManyRef(4)
		ngmodels.AlertRulesBy(ngmodels.AlertRulesByIndex).Sort(rules)
		// Set health states
		fakeStore.PutRule(context.Background(), rules...)

		// create alert instances for each rule
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1)
		fakeAIM.GenerateAlertInstances(orgID, rules[1].UID, 1, withAlertingErrorState())
		fakeAIM.GenerateAlertInstances(orgID, rules[2].UID, 1, withErrorState())
		fakeAIM.GenerateAlertInstances(orgID, rules[3].UID, 1, withNoDataState())

		t.Run("invalid health returns 400 Bad Request", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=blah", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusBadRequest, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Contains(t, res.Error, "unknown health")
		})

		t.Run("first without filters", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 4)
		})

		t.Run("then with filter for ok health", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=ok", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Equal(t, "ok", rg.Rules[0].Health)
		})

		t.Run("then with filter for error health", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=error", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 2)
			require.Equal(t, "error", rg.Rules[0].Health)
		})

		t.Run("then with filter for nodata health", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=nodata", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Equal(t, "nodata", rg.Rules[0].Health)
		})

		t.Run("then with multiple health filters", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=ok&health=error", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 3)
			healths := []string{rg.Rules[0].Health, rg.Rules[1].Health}
			require.ElementsMatch(t, healths, []string{"ok", "error"})
		})

		t.Run("then with all rules filtered out, no groups returned", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?health=unknown", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 0)
		})
	})

	t.Run("test with matcher on labels", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		// create two rules in the same Rule Group to keep assertions simple
		rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			NamespaceUID: "Folder-1",
			RuleGroup:    "Rule-Group-1",
			OrgID:        orgID,
		})).GenerateManyRef(1)
		fakeStore.PutRule(context.Background(), rules...)

		// create a normal and alerting state for each rule
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1,
			withLabels(data.Labels{"test": "value1"}))
		fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1,
			withLabels(data.Labels{"test": "value2"}), withAlertingState())

		t.Run("invalid matchers returns 400 Bad Request", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?matcher={\"name\":\"\"}", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusBadRequest, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Equal(t, "bad matcher: the name cannot be blank", res.Error)
		})

		t.Run("first without matchers", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Len(t, rg.Rules[0].Alerts, 2)
		})

		t.Run("then with single matcher", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?matcher={\"name\":\"test\",\"isEqual\":true,\"value\":\"value1\"}", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be just the alert with the label test=value1
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Len(t, rg.Rules[0].Alerts, 1)

			require.Equal(t, map[string]int64{"normal": 1, "alerting": 1}, rg.Rules[0].Totals)
			// There should be a totalFiltered of 1 though since the matcher matched a single instance.
			require.Equal(t, map[string]int64{"normal": 1}, rg.Rules[0].TotalsFiltered)
		})

		t.Run("then with URL encoded regex matcher", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?matcher=%7B%22name%22:%22test%22%2C%22isEqual%22:true%2C%22isRegex%22:true%2C%22value%22:%22value%5B0-9%5D%2B%22%7D%0A", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be just the alert with the label test=value1
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Len(t, rg.Rules[0].Alerts, 2)
		})

		t.Run("then with multiple matchers", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?matcher={\"name\":\"alertname\",\"isEqual\":true,\"value\":\"test_title_0\"}&matcher={\"name\":\"test\",\"isEqual\":true,\"value\":\"value1\"}", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be just the alert with the label test=value1
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Len(t, rg.Rules[0].Alerts, 1)
		})

		t.Run("then with multiple matchers that don't match", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?matcher={\"name\":\"alertname\",\"isEqual\":true,\"value\":\"test_title_0\"}&matcher={\"name\":\"test\",\"isEqual\":true,\"value\":\"value3\"}", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should no alerts
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Len(t, rg.Rules[0].Alerts, 0)
		})

		t.Run("then with single matcher and limit_alerts", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?limit_alerts=0&matcher={\"name\":\"test\",\"isEqual\":true,\"value\":\"value1\"}", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be no alerts since we limited to 0.
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Len(t, rg.Rules[0].Alerts, 0)

			require.Equal(t, map[string]int64{"normal": 1, "alerting": 1}, rg.Rules[0].Totals)
			// There should be a totalFiltered of 1 though since the matcher matched a single instance.
			require.Equal(t, map[string]int64{"normal": 1}, rg.Rules[0].TotalsFiltered)
		})
	})

	t.Run("test with a contact point filter", func(t *testing.T) {
		fakeStore, _, api := setupAPI(t)
		rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
			NamespaceUID: "Folder-1",
			RuleGroup:    "Rule-Group-1",
			OrgID:        orgID,
		}), gen.WithNotificationSettings(
			ngmodels.NotificationSettings{
				Receiver: "webhook-a",
				GroupBy:  []string{"alertname"},
			},
		)).GenerateManyRef(1)
		fakeStore.PutRule(context.Background(), rules...)

		t.Run("unknown receiver_name returns empty list", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?receiver_name=webhook-b", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Len(t, res.Data.RuleGroups, 0)
		})
		t.Run("known receiver_name returns rules with that receiver", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?receiver_name=webhook-a", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			require.Len(t, rg.Rules, 1)
			require.Equal(t, "webhook-a", rg.Rules[0].NotificationSettings.Receiver)
		})
	})

	t.Run("provenance as expected", func(t *testing.T) {
		fakeStore, fakeAIM, api, provStore := setupAPIFull(t)
		// Rule without provenance
		ruleNoProv := gen.With(gen.WithOrgID(orgID), asFixture(), withClassicConditionSingleQuery()).GenerateRef()
		fakeAIM.GenerateAlertInstances(orgID, ruleNoProv.UID, 1)
		fakeStore.PutRule(context.Background(), ruleNoProv)

		// Rule with provenance
		ruleWithProv := gen.With(gen.WithOrgID(orgID), asFixture(), withClassicConditionSingleQuery()).GenerateRef()
		ruleWithProv.UID = "provRuleUID"
		ruleWithProv.Title = "ProvisionedRule"
		fakeAIM.GenerateAlertInstances(orgID, ruleWithProv.UID, 1)
		fakeStore.PutRule(context.Background(), ruleWithProv)

		// Add provenance for ruleWithProv
		err := provStore.SetProvenance(context.Background(), ruleWithProv, orgID, ngmodels.ProvenanceAPI)
		require.NoError(t, err)

		req, err := http.NewRequest("GET", "/api/v1/rules", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{
			Context: &web.Context{Req: req},
			SignedInUser: &user.SignedInUser{
				OrgID:       orgID,
				Permissions: map[int64]map[string][]string{orgID: {datasources.ActionQuery: {datasources.ScopeAll}}},
			},
		}

		resp := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, resp.Status())
		var res apimodels.RuleResponse
		require.NoError(t, json.Unmarshal(resp.Body(), &res))

		// Should have two rules in one group
		require.Len(t, res.Data.RuleGroups, 1)
		rg := res.Data.RuleGroups[0]
		require.Len(t, rg.Rules, 2)

		// Find rules by UID
		var foundNoProv, foundWithProv bool
		for _, rule := range rg.Rules {
			switch rule.UID {
			case ruleNoProv.UID:
				foundNoProv = true
				require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceNone), rule.Provenance, "non-provisioned rule should have empty provenance")
			case ruleWithProv.UID:
				foundWithProv = true
				require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceAPI), rule.Provenance, "provisioned rule should have provenance set")
			}
		}
		require.True(t, foundNoProv, "should find rule without provenance")
		require.True(t, foundWithProv, "should find rule with provenance")
	})
}

func setupAPI(t *testing.T) (*fakes.RuleStore, *fakeAlertInstanceManager, PrometheusSrv) {
	fakeStore, fakeAIM, api, _ := setupAPIFull(t)
	return fakeStore, fakeAIM, api
}

func setupAPIFull(t *testing.T) (*fakes.RuleStore, *fakeAlertInstanceManager, PrometheusSrv, *fakes.FakeProvisioningStore) {
	fakeStore := fakes.NewRuleStore(t)
	fakeAIM := NewFakeAlertInstanceManager(t)
	fakeSch := newFakeSchedulerReader(t).setupStates(fakeAIM)
	fakeAuthz := &fakeRuleAccessControlService{}
	fakeProvisioning := fakes.NewFakeProvisioningStore()

	api := *NewPrometheusSrv(
		log.NewNopLogger(),
		fakeAIM,
		fakeSch,
		fakeStore,
		fakeAuthz,
		fakeProvisioning,
	)

	return fakeStore, fakeAIM, api, fakeProvisioning
}

func generateRuleAndInstanceWithQuery(t *testing.T, orgID int64, fakeAIM *fakeAlertInstanceManager, fakeStore *fakes.RuleStore, query ngmodels.AlertRuleMutator, additionalMutators ...ngmodels.AlertRuleMutator) {
	t.Helper()

	gen := ngmodels.RuleGen
	r := gen.With(append([]ngmodels.AlertRuleMutator{gen.WithOrgID(orgID), asFixture(), query}, additionalMutators...)...).GenerateRef()

	fakeAIM.GenerateAlertInstances(orgID, r.UID, 1, func(s *state.State) *state.State {
		s.Labels = data.Labels{
			"job":                            "prometheus",
			alertingModels.NamespaceUIDLabel: "test_namespace_uid",
			alertingModels.RuleUIDLabel:      "test_alert_rule_uid_0",
		}
		s.Annotations = data.Labels{"severity": "critical"}
		return s
	})

	fakeStore.PutRule(context.Background(), r)
}

// asFixture removes variable values of the alert rule.
// we're not too interested in variability of the rule in this scenario.
func asFixture() ngmodels.AlertRuleMutator {
	return func(r *ngmodels.AlertRule) {
		r.Title = "AlwaysFiring"
		r.NamespaceUID = "namespaceUID"
		r.RuleGroup = "rule-group"
		r.UID = "RuleUID"
		r.Labels = map[string]string{
			"__a_private_label_on_the_rule__": "a_value",
			alertingModels.RuleUIDLabel:       "RuleUID",
		}
		r.Annotations = nil
		r.IntervalSeconds = 60
		r.For = 180 * time.Second
		r.KeepFiringFor = 10 * time.Second
	}
}

func withClassicConditionSingleQuery() ngmodels.AlertRuleMutator {
	return func(r *ngmodels.AlertRule) {
		queries := []ngmodels.AlertQuery{
			{
				RefID:             "A",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     "AUID",
				Model:             json.RawMessage(fmt.Sprintf(prometheusQueryModel, "A")),
			},
			{
				RefID:             "B",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     expr.DatasourceUID,
				Model:             json.RawMessage(fmt.Sprintf(classicConditionsModel, "A", "B")),
			},
		}
		r.Data = queries
	}
}

func withExpressionsMultiQuery() ngmodels.AlertRuleMutator {
	return func(r *ngmodels.AlertRule) {
		queries := []ngmodels.AlertQuery{
			{
				RefID:             "A",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     "AUID",
				Model:             json.RawMessage(fmt.Sprintf(prometheusQueryModel, "A")),
			},
			{
				RefID:             "B",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     "BUID",
				Model:             json.RawMessage(fmt.Sprintf(prometheusQueryModel, "B")),
			},
			{
				RefID:             "C",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     expr.DatasourceUID,
				Model:             json.RawMessage(fmt.Sprintf(reduceLastExpressionModel, "A", "C")),
			},
			{
				RefID:             "D",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     expr.DatasourceUID,
				Model:             json.RawMessage(fmt.Sprintf(reduceLastExpressionModel, "B", "D")),
			},
			{
				RefID:             "E",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     expr.DatasourceUID,
				Model:             json.RawMessage(fmt.Sprintf(mathExpressionModel, "A", "B", "E")),
			},
		}
		r.Data = queries
	}
}
