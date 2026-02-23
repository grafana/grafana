package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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
	"github.com/grafana/grafana/pkg/services/folder"
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

//nolint:gocyclo
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

	t.Run("evaluationTime should come from state with newest LastEvaluationTime", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)

		rule := gen.With(asFixture(), withClassicConditionSingleQuery(), gen.WithNoNotificationSettings()).GenerateRef()
		fakeStore.PutRule(context.Background(), rule)

		// Create two states with different evaluation times and durations.
		// State 1: newer evaluation time
		// State 2: older evaluation time
		baseTime := timeNow()
		newerTime := baseTime.Add(2 * time.Minute)
		newerDuration := 5 * time.Second
		olderTime := baseTime.Add(1 * time.Minute)
		olderDuration := 10 * time.Second

		fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, func(s *state.State) *state.State {
			s.Labels = data.Labels{"instance": "newer"}
			s.LastEvaluationTime = newerTime
			s.EvaluationDuration = newerDuration
			return s
		})
		fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, func(s *state.State) *state.State {
			s.Labels = data.Labels{"instance": "older"}
			s.LastEvaluationTime = olderTime
			s.EvaluationDuration = olderDuration
			return s
		})

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())

		var res apimodels.RuleResponse
		require.NoError(t, json.Unmarshal(r.Body(), &res))
		require.Len(t, res.Data.RuleGroups, 1)
		require.Len(t, res.Data.RuleGroups[0].Rules, 1)

		ruleResult := res.Data.RuleGroups[0].Rules[0]
		require.Equal(t, newerTime, ruleResult.LastEvaluation, "LastEvaluation should be from state with newest evaluation time")
		require.Equal(t, newerDuration.Seconds(), ruleResult.EvaluationTime, "EvaluationTime should be from state with newest LastEvaluationTime")
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
		notificationSettings := ngmodels.ContactPointRouting{
			Receiver: "test-receiver",
			GroupBy:  []string{"job"},
		}
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(), gen.WithContactPointRouting(notificationSettings), gen.WithIsPaused(false))
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
					actualNames := make([]string, 0, len(group.Rules))
					expectedNames := make([]string, 0, len(rules))
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

		// Plugin rule with __grafana_origin label for plugins filter test
		pluginRule := gen.With(
			gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
				RuleGroup:    "plugins-test-plugin",
				NamespaceUID: "folder-2",
				OrgID:        orgID,
			}),
			gen.WithLabels(map[string]string{"__grafana_origin": "plugin/grafana-slo-app"}),
		).GenerateRef()

		ruleStore.PutRule(context.Background(), rulesInGroup1...)
		ruleStore.PutRule(context.Background(), rulesInGroup2...)
		ruleStore.PutRule(context.Background(), rulesInGroup3...)
		ruleStore.PutRule(context.Background(), pluginRule)

		api := NewPrometheusSrv(
			log.NewNopLogger(),
			fakeAIM,
			newFakeSchedulerReader(t).setupStates(fakeAIM),
			ruleStore,
			accesscontrol.NewRuleService(acimpl.ProvideAccessControl(featuremgmt.WithFeatures())),
			fakes.NewFakeProvisioningStore(),
		)

		permissions := createPermissionsForRules(slices.Concat(rulesInGroup1, rulesInGroup2, rulesInGroup3, []*ngmodels.AlertRule{pluginRule}), orgID)
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

		t.Run("should only return rules with given rule_uid list", func(t *testing.T) {
			expectedRuleInGroup1 := rulesInGroup1[0]
			expectedRuleInGroup3 := rulesInGroup3[1]

			r, err := http.NewRequest("GET", fmt.Sprintf("/api/v1/rules?rule_uid=%s&rule_uid=%s", expectedRuleInGroup1.UID, expectedRuleInGroup3.UID), nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2)
			require.True(t, slices.ContainsFunc(result.Data.RuleGroups, func(rg apimodels.RuleGroup) bool {
				return rg.Name == "rule-group-1"
			}))
			require.True(t, slices.ContainsFunc(result.Data.RuleGroups, func(rg apimodels.RuleGroup) bool {
				return rg.Name == "rule-group-3"
			}))
			require.Len(t, result.Data.RuleGroups[0].Rules, 1)
			require.Len(t, result.Data.RuleGroups[1].Rules, 1)

			if result.Data.RuleGroups[0].Name == "rule-group-1" {
				require.Equal(t, expectedRuleInGroup1.UID, result.Data.RuleGroups[0].Rules[0].UID)
				require.Equal(t, expectedRuleInGroup3.UID, result.Data.RuleGroups[1].Rules[0].UID)
			} else {
				require.Equal(t, expectedRuleInGroup1.UID, result.Data.RuleGroups[1].Rules[0].UID)
				require.Equal(t, expectedRuleInGroup3.UID, result.Data.RuleGroups[0].Rules[0].UID)
			}
		})

		t.Run("should filter rules by plugins parameter", func(t *testing.T) {
			t.Run("returns all groups when plugins filter not specified", func(t *testing.T) {
				r, err := http.NewRequest("GET", "/api/v1/rules?folder_uid=folder-2", nil)
				require.NoError(t, err)
				c.Context = &web.Context{Req: r}

				resp := api.RouteGetRuleStatuses(c)
				require.Equal(t, http.StatusOK, resp.Status())

				result := &apimodels.RuleResponse{}
				require.NoError(t, json.Unmarshal(resp.Body(), result))

				require.Len(t, result.Data.RuleGroups, 2, "should return all groups including plugin group")
			})

			t.Run("excludes plugin rules when plugins=hide", func(t *testing.T) {
				r, err := http.NewRequest("GET", "/api/v1/rules?folder_uid=folder-2&plugins=hide", nil)
				require.NoError(t, err)
				c.Context = &web.Context{Req: r}

				resp := api.RouteGetRuleStatuses(c)
				require.Equal(t, http.StatusOK, resp.Status())

				result := &apimodels.RuleResponse{}
				require.NoError(t, json.Unmarshal(resp.Body(), result))

				require.Len(t, result.Data.RuleGroups, 1, "should only return non-plugin groups")
				for _, group := range result.Data.RuleGroups {
					require.NotEqual(t, "plugins-test-plugin", group.Name, "should not include plugin group")
				}
			})

			t.Run("returns only plugin rules when plugins=only", func(t *testing.T) {
				r, err := http.NewRequest("GET", "/api/v1/rules?folder_uid=folder-2&plugins=only", nil)
				require.NoError(t, err)
				c.Context = &web.Context{Req: r}

				resp := api.RouteGetRuleStatuses(c)
				require.Equal(t, http.StatusOK, resp.Status())

				result := &apimodels.RuleResponse{}
				require.NoError(t, json.Unmarshal(resp.Body(), result))

				require.Len(t, result.Data.RuleGroups, 1, "should only return plugin group")
				require.Equal(t, "plugins-test-plugin", result.Data.RuleGroups[0].Name)
			})

			t.Run("returns all groups when plugins filter has invalid value", func(t *testing.T) {
				r, err := http.NewRequest("GET", "/api/v1/rules?folder_uid=folder-2&plugins=invalid", nil)
				require.NoError(t, err)
				c.Context = &web.Context{Req: r}

				resp := api.RouteGetRuleStatuses(c)
				require.Equal(t, http.StatusOK, resp.Status())

				result := &apimodels.RuleResponse{}
				require.NoError(t, json.Unmarshal(resp.Body(), result))

				require.Len(t, result.Data.RuleGroups, 2, "invalid value should return all groups")
			})
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

	t.Run("when requesting rules with rule_limit pagination", func(t *testing.T) {
		const namespaceUID = "namespace_0"

		ruleStore := fakes.NewRuleStore(t)
		fakeAIM := NewFakeAlertInstanceManager(t)

		// Generate 3 rule groups with 10 rules each
		allRules := make([]*ngmodels.AlertRule, 0, 30)
		for i := range 3 {
			rules := gen.With(gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
				RuleGroup:    fmt.Sprintf("rule_group_%d", i),
				NamespaceUID: namespaceUID,
				OrgID:        orgID,
			})).GenerateManyRef(10)

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

		t.Run("should return complete groups until rule_limit is met", func(t *testing.T) {
			// With rule_limit=15, should return group-0 (10) + group-1 (10)
			// Even though 20 > 15, we never return partial groups
			r, err := http.NewRequest("GET", "/api/v1/rules?rule_limit=15", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2, "should return 2 groups")
			require.Len(t, result.Data.Totals, 0)
			require.Equal(t, "rule_group_0", result.Data.RuleGroups[0].Name)
			require.Equal(t, "rule_group_1", result.Data.RuleGroups[1].Name)
			require.Len(t, result.Data.RuleGroups[0].Rules, 10)
			require.Len(t, result.Data.RuleGroups[1].Rules, 10)

			expectedToken := ngmodels.EncodeGroupCursor(ngmodels.GroupCursor{
				NamespaceUID: namespaceUID,
				RuleGroup:    "rule_group_1",
			})
			require.Equal(t, expectedToken, result.Data.NextToken)
		})

		t.Run("should return two groups when the number of alerts == limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?rule_limit=20", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2, "should return 2 groups")
			require.Len(t, result.Data.Totals, 0)
			require.Equal(t, "rule_group_0", result.Data.RuleGroups[0].Name)
			require.Equal(t, "rule_group_1", result.Data.RuleGroups[1].Name)
			require.Len(t, result.Data.RuleGroups[0].Rules, 10)
			require.Len(t, result.Data.RuleGroups[1].Rules, 10)

			expectedToken := ngmodels.EncodeGroupCursor(ngmodels.GroupCursor{
				NamespaceUID: namespaceUID,
				RuleGroup:    "rule_group_1",
			})
			require.Equal(t, expectedToken, result.Data.NextToken)
		})

		t.Run("should respect group_limit when it is reached first", func(t *testing.T) {
			// group_limit=1 with rule_limit=100: group limit reached first
			r, err := http.NewRequest("GET", "/api/v1/rules?group_limit=1&rule_limit=100", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 1, "should return 1 group (group_limit=1)")
			require.Len(t, result.Data.Totals, 0)

			expectedToken := ngmodels.EncodeGroupCursor(ngmodels.GroupCursor{
				NamespaceUID: namespaceUID,
				RuleGroup:    "rule_group_0",
			})
			require.Equal(t, expectedToken, result.Data.NextToken)
		})

		t.Run("should respect rule_limit when it is reached first", func(t *testing.T) {
			// rule_limit=15 with group_limit=5: rule limit reached first (returns 2 groups, 20 rules)
			r, err := http.NewRequest("GET", "/api/v1/rules?group_limit=5&rule_limit=15", nil)
			require.NoError(t, err)

			c.Context = &web.Context{Req: r}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			result := &apimodels.RuleResponse{}
			require.NoError(t, json.Unmarshal(resp.Body(), result))

			require.Len(t, result.Data.RuleGroups, 2, "should return 2 groups (20 rules exceeds rule_limit=15)")
			require.Len(t, result.Data.Totals, 0)

			expectedToken := ngmodels.EncodeGroupCursor(ngmodels.GroupCursor{
				NamespaceUID: namespaceUID,
				RuleGroup:    "rule_group_1",
			})
			require.Equal(t, expectedToken, result.Data.NextToken)
		})

		t.Run("should return nothing when using rule_limit=0", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?rule_limit=0", nil)
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
			ngmodels.NotificationSettingsGen(ngmodels.NSMuts.WithReceiver("webhook-a"), ngmodels.NSMuts.WithGroupBy("alertname"))(),
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

	t.Run("compact mode with receiver_name filter returns only matching rules", func(t *testing.T) {
		fakeStore, _, api := setupAPI(t)

		ruleA := gen.With(
			gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
				NamespaceUID: "folder-1",
				RuleGroup:    "group-1",
				OrgID:        orgID,
			}),
			gen.WithContactPointRouting(
				ngmodels.ContactPointRouting{
					Receiver: "receiver-a",
					GroupBy:  []string{"alertname"},
				},
			),
		).GenerateRef()
		fakeStore.PutRule(context.Background(), ruleA)

		ruleB := gen.With(
			gen.WithGroupKey(ngmodels.AlertRuleGroupKey{
				NamespaceUID: "folder-2",
				RuleGroup:    "group-2",
				OrgID:        orgID,
			}),
			gen.WithContactPointRouting(
				ngmodels.ContactPointRouting{
					Receiver: "receiver-b",
					GroupBy:  []string{"alertname"},
				},
			),
		).GenerateRef()
		fakeStore.PutRule(context.Background(), ruleB)
		r, err := http.NewRequest("GET", "/api/v1/rules?compact=true&receiver_name=receiver-a", nil)
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
		require.Equal(t, "group-1", res.Data.RuleGroups[0].Name)
		require.Empty(t, res.Data.RuleGroups[0].Rules[0].Query, "Query should be empty in compact mode")
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

	t.Run("filter-aware pagination", func(t *testing.T) {
		createRulesWithState := func(t *testing.T, store *fakes.RuleStore, aim *fakeAlertInstanceManager,
			orgID int64, numGroups int, rulesPerGroup int,
			stateFunc func(groupIdx int) eval.State,
			healthFunc func(groupIdx int) error,
			stateMutators ...func(groupIdx int, s *state.State) *state.State) {
			t.Helper()

			// create folders
			for i := 1; i <= numGroups; i++ {
				store.Folders[orgID] = append(store.Folders[orgID], &folder.Folder{
					ID:       int64(i),
					UID:      fmt.Sprintf("ns-%d", i),
					Title:    fmt.Sprintf("Namespace %d", i),
					Fullpath: fmt.Sprintf("/namespace-%d", i),
				})
			}

			for i := 0; i < numGroups; i++ {
				for j := 0; j < rulesPerGroup; j++ {
					rule := gen.With(gen.WithOrgID(orgID), func(r *ngmodels.AlertRule) {
						r.NamespaceUID = fmt.Sprintf("ns-%d", i+1)
						r.RuleGroup = fmt.Sprintf("group-%d", i+1)
						r.UID = fmt.Sprintf("rule-%d-%d", i+1, j+1)
					}, withClassicConditionSingleQuery()).GenerateRef()

					alertState := stateFunc(i)
					healthErr := healthFunc(i)

					aim.GenerateAlertInstances(orgID, rule.UID, 1, func(s *state.State) *state.State {
						s.State = alertState
						s.Error = healthErr
						s.Labels = data.Labels{"test": "label"}

						for _, mutator := range stateMutators {
							s = mutator(i, s)
						}
						return s
					})
					store.PutRule(context.Background(), rule)
				}
			}
		}

		t.Run("state filter fetches multiple pages to fill group_limit", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 10 groups (2 rules each = 20 rules total): groups 1,3,5,7,9 firing, groups 2,4,6,8,10 normal
			// Request group_limit=3 with state=firing should fetch pages until 3 firing groups collected
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 10, 2,
				func(i int) eval.State {
					if i%2 == 0 {
						return eval.Alerting
					}
					return eval.Normal
				},
				func(i int) error { return nil })

			// Request 3 groups with state=firing filter
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&group_limit=3", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 3 firing groups
			require.Len(t, res.Data.RuleGroups, 3)
			require.Equal(t, "group-1", res.Data.RuleGroups[0].Name)
			require.Equal(t, "group-3", res.Data.RuleGroups[1].Name)
			require.Equal(t, "group-5", res.Data.RuleGroups[2].Name)

			// Verify all have firing alerts
			for _, rg := range res.Data.RuleGroups {
				hasFiring := false
				for _, rule := range rg.Rules {
					for _, alert := range rule.Alerts {
						if alert.State == eval.Alerting.String() {
							hasFiring = true
						}
					}
				}
				require.True(t, hasFiring)
			}
		})

		t.Run("multi-page pagination loads provenance correctly", func(t *testing.T) {
			fakeStore, fakeAIM, api, fakeProvisioning := setupAPIFull(t)

			// Create 3 groups with 1 rule each: groups 1 and 3 firing, group 2 normal
			for i := 1; i <= 3; i++ {
				rule := gen.With(gen.WithOrgID(orgID), func(r *ngmodels.AlertRule) {
					r.NamespaceUID = "ns-1"
					r.RuleGroup = fmt.Sprintf("group-%d", i)
					r.UID = fmt.Sprintf("rule-%d", i)
				}, withClassicConditionSingleQuery()).GenerateRef()

				alertState := eval.Normal
				if i != 2 {
					alertState = eval.Alerting
				}
				fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, func(s *state.State) *state.State {
					s.State = alertState
					s.Labels = data.Labels{"test": "label"}
					return s
				})
				fakeStore.PutRule(context.Background(), rule)
			}

			// Set provenance for all rules
			err := fakeProvisioning.SetProvenance(context.Background(),
				&ngmodels.AlertRule{UID: "rule-1", OrgID: orgID}, orgID, ngmodels.ProvenanceAPI)
			require.NoError(t, err)
			err = fakeProvisioning.SetProvenance(context.Background(),
				&ngmodels.AlertRule{UID: "rule-3", OrgID: orgID}, orgID, ngmodels.ProvenanceFile)
			require.NoError(t, err)

			// Request firing groups with group_limit=2 - fetches multiple pages, skipping group 2
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&group_limit=2", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 2 firing groups
			require.Len(t, res.Data.RuleGroups, 2)
			require.Equal(t, "group-1", res.Data.RuleGroups[0].Name)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceAPI), res.Data.RuleGroups[0].Rules[0].Provenance)
			require.Equal(t, "group-3", res.Data.RuleGroups[1].Name)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceFile), res.Data.RuleGroups[1].Rules[0].Provenance)
		})

		t.Run("provenance fetch error returns error response in paginated mode", func(t *testing.T) {
			fakeStore, fakeAIM, api, fakeProvisioning := setupAPIFull(t)

			rule := gen.With(gen.WithOrgID(orgID), func(r *ngmodels.AlertRule) {
				r.NamespaceUID = "ns-1"
				r.RuleGroup = "group-1"
				r.UID = "rule-1"
			}, withClassicConditionSingleQuery()).GenerateRef()

			fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, func(s *state.State) *state.State {
				s.State = eval.Alerting
				s.Labels = data.Labels{"test": "label"}
				return s
			})
			fakeStore.PutRule(context.Background(), rule)

			fakeProvisioning.GetProvenancesByUIDsFunc = func(ctx context.Context, orgID int64, resourceType string, uids []string) (map[string]ngmodels.Provenance, error) {
				return nil, errors.New("database connection failed")
			}

			req, err := http.NewRequest("GET", "/api/v1/rules?group_limit=10", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusInternalServerError, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Equal(t, "error", res.Status)
			require.Contains(t, res.Error, "failed to load provenance")
		})

		t.Run("provenance fetch error returns error response in non-paginated mode", func(t *testing.T) {
			fakeStore, fakeAIM, api, fakeProvisioning := setupAPIFull(t)

			rule := gen.With(gen.WithOrgID(orgID), func(r *ngmodels.AlertRule) {
				r.NamespaceUID = "ns-1"
				r.RuleGroup = "group-1"
				r.UID = "rule-1"
			}, withClassicConditionSingleQuery()).GenerateRef()

			fakeAIM.GenerateAlertInstances(orgID, rule.UID, 1, func(s *state.State) *state.State {
				s.State = eval.Alerting
				s.Labels = data.Labels{"test": "label"}
				return s
			})
			fakeStore.PutRule(context.Background(), rule)

			fakeProvisioning.GetProvenancesFunc = func(ctx context.Context, orgID int64, resourceType string) (map[string]ngmodels.Provenance, error) {
				return nil, errors.New("database connection failed")
			}

			req, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusInternalServerError, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))
			require.Equal(t, "error", res.Status)
			require.Contains(t, res.Error, "failed to load provenance")
		})

		t.Run("state filter continues when first page has no matches", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 8 groups (2 rules each = 16 rules total): first 4 normal, last 4 firing
			// Request state=firing with group_limit=2 should skip first 4 and return groups 5,6
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 8, 2,
				func(i int) eval.State {
					if i < 4 {
						return eval.Normal // groups 1-4 normal
					}
					return eval.Alerting // groups 5-8 firing
				},
				func(i int) error { return nil })

			// Request 2 firing groups - should skip past the first page of normal rules
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&group_limit=2", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 2 firing groups
			require.Len(t, res.Data.RuleGroups, 2)
			require.Equal(t, "group-5", res.Data.RuleGroups[0].Name)
			require.Equal(t, "group-6", res.Data.RuleGroups[1].Name)
		})

		t.Run("health filter fetches multiple pages", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 8 groups (2 rules each = 16 rules total): groups 1,3,5,7 with error health, groups 2,4,6,8 with ok health
			// Request health=error with group_limit=3 should fetch pages until 3 error groups collected
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 8, 2,
				func(i int) eval.State { return eval.Normal },
				func(i int) error {
					if i%2 == 0 {
						return fmt.Errorf("evaluation error")
					}
					return nil
				})

			// Request 3 groups with health=error filter
			req, err := http.NewRequest("GET", "/api/v1/rules?health=error&group_limit=3", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 3 error groups
			require.Len(t, res.Data.RuleGroups, 3)
			require.Equal(t, "group-1", res.Data.RuleGroups[0].Name)
			require.Equal(t, "group-3", res.Data.RuleGroups[1].Name)
			require.Equal(t, "group-5", res.Data.RuleGroups[2].Name)

			// Verify all have error health
			for _, rg := range res.Data.RuleGroups {
				for _, rule := range rg.Rules {
					require.Equal(t, "error", rule.Health)
				}
			}
		})

		t.Run("combined state and health filters", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 10 groups (2 rules each = 20 rules total)
			// Groups 1-5: firing, groups 6-10: normal
			// Groups 1,3,5,7,9: ok health, groups 2,4,6,8,10: error health
			// Groups matching both filters (firing + ok): 1,3,5
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 10, 2,
				func(i int) eval.State {
					if i < 5 {
						return eval.Alerting
					}
					return eval.Normal
				},
				func(i int) error {
					if i%2 == 1 {
						return fmt.Errorf("evaluation error")
					}
					return nil
				})

			// Request 3 groups with state=firing AND health=ok
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&health=ok&group_limit=3", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 3 groups matching both filters
			require.Len(t, res.Data.RuleGroups, 3)
			require.Equal(t, "group-1", res.Data.RuleGroups[0].Name)
			require.Equal(t, "group-3", res.Data.RuleGroups[1].Name)
			require.Equal(t, "group-5", res.Data.RuleGroups[2].Name)

			// Verify all match both criteria
			for _, rg := range res.Data.RuleGroups {
				for _, rule := range rg.Rules {
					require.Equal(t, "ok", rule.Health)
					hasFiring := false
					for _, alert := range rule.Alerts {
						if alert.State == eval.Alerting.String() {
							hasFiring = true
						}
					}
					require.True(t, hasFiring)
				}
			}
		})

		t.Run("rule_limit hit before group_limit", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 5 groups (3 rules each = 15 rules total)
			// Request: group_limit=10, rule_limit=8
			// Expected: Should return groups 1-3 (9 rules total, exceeds limit but complete group included)
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 5, 3,
				func(i int) eval.State { return eval.Alerting }, // all firing
				func(i int) error { return nil })                // all healthy

			// Request group_limit=10, rule_limit=8 - rule limit should hit first
			req, err := http.NewRequest("GET", "/api/v1/rules?group_limit=10&rule_limit=8", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Expected behavior with rule_limit=8:
			// Group 1: 3 rules (total: 3, under 8, continue)
			// Group 2: 3 rules (total: 6, under 8, continue)
			// Group 3: 3 rules (total: 9, exceeds 8 but we include complete group)
			// Result: 3 groups, 9 rules total
			totalRules := 0
			for _, rg := range res.Data.RuleGroups {
				t.Logf("Group %s has %d rules", rg.Name, len(rg.Rules))
				totalRules += len(rg.Rules)
			}
			t.Logf("Total: %d rules, %d groups", totalRules, len(res.Data.RuleGroups))
			require.Equal(t, 9, totalRules)
			require.Equal(t, 3, len(res.Data.RuleGroups))
		})

		t.Run("rule_limit without group_limit", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 10 groups (2 rules each = 20 rules total)
			// Request rule_limit=7 should stop after 4 groups (8 rules total)
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 10, 2,
				func(i int) eval.State { return eval.Alerting },
				func(i int) error { return nil })

			// Request rule_limit=7 only (group_limit unlimited)
			req, err := http.NewRequest("GET", "/api/v1/rules?rule_limit=7", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 4 groups (8 rules total, stops after exceeding 7)
			totalRules := 0
			for _, rg := range res.Data.RuleGroups {
				totalRules += len(rg.Rules)
			}
			require.Equal(t, 8, totalRules)
			require.Equal(t, 4, len(res.Data.RuleGroups))
			require.NotEmpty(t, res.Data.NextToken)
		})

		t.Run("empty page in middle of pagination", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 15 groups (2 rules each = 30 rules total): groups 1-3 firing, 4-8 normal, 9-13 firing, 14-15 normal
			// Request state=firing with group_limit=5 should skip over normal groups
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 15, 2,
				func(i int) eval.State {
					groupNum := i + 1
					if groupNum <= 3 || (groupNum >= 9 && groupNum <= 13) {
						return eval.Alerting
					}
					return eval.Normal
				},
				func(i int) error { return nil })

			// Request state=firing, group_limit=5
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&group_limit=5", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Should return 5 firing groups from pages 1 and 3 (skipping empty page 2)
			require.Len(t, res.Data.RuleGroups, 5)

			// Verify all are firing
			for _, rg := range res.Data.RuleGroups {
				for _, rule := range rg.Rules {
					for _, alert := range rule.Alerts {
						require.Equal(t, eval.Alerting.String(), alert.State)
					}
				}
			}
		})

		t.Run("group_limit=0 returns empty response", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 1 group (2 rules) to verify group_limit=0 returns empty
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 1, 2,
				func(i int) eval.State { return eval.Alerting },
				func(i int) error { return nil })

			// Request group_limit=0
			req, err := http.NewRequest("GET", "/api/v1/rules?group_limit=0", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
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
			require.Empty(t, res.Data.NextToken)
		})

		t.Run("resume with token and filters active", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 10 groups (2 rules each = 20 rules total): odd groups firing, even groups normal
			// Test pagination continuation with state filter: first page returns groups 1,3 then second page returns groups 5,7
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 10, 2,
				func(i int) eval.State {
					if i%2 == 0 {
						return eval.Alerting
					}
					return eval.Normal
				},
				func(i int) error { return nil })

			// First request: state=firing, group_limit=2
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&group_limit=2", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res1 apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res1))

			// Should return 2 firing groups (1, 3)
			require.Len(t, res1.Data.RuleGroups, 2)
			require.NotEmpty(t, res1.Data.NextToken)

			// Verify both are firing
			for _, rg := range res1.Data.RuleGroups {
				for _, rule := range rg.Rules {
					require.Equal(t, "firing", rule.State)
				}
			}

			// Second request: resume with token AND filter still active
			req2, err := http.NewRequest("GET", fmt.Sprintf("/api/v1/rules?state=firing&group_limit=2&group_next_token=%s", res1.Data.NextToken), nil)
			require.NoError(t, err)
			c2 := &contextmodel.ReqContext{
				Context: &web.Context{Req: req2},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp2 := api.RouteGetRuleStatuses(c2)
			require.Equal(t, http.StatusOK, resp2.Status())

			var res2 apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp2.Body(), &res2))

			// Should return next 2 firing groups (5, 7)
			require.Len(t, res2.Data.RuleGroups, 2)
			require.NotEmpty(t, res2.Data.NextToken)

			// Verify both are firing
			for _, rg := range res2.Data.RuleGroups {
				for _, rule := range rg.Rules {
					require.Equal(t, "firing", rule.State)
				}
			}

			// Verify we got different groups than first request
			firstGroupNames := make(map[string]bool)
			for _, rg := range res1.Data.RuleGroups {
				firstGroupNames[rg.Name] = true
			}
			for _, rg := range res2.Data.RuleGroups {
				require.False(t, firstGroupNames[rg.Name])
			}
		})

		t.Run("rule_limit with state filter", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 10 groups (2 rules each = 20 rules total), alternating firing/normal
			// Firing groups: 1,3,5,7,9 (5 groups × 2 rules = 10 firing rules)
			// Request state=firing with rule_limit=7 should return groups 1,3,5,7 (8 rules)
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 10, 2,
				func(i int) eval.State {
					if i%2 == 0 {
						return eval.Alerting
					}
					return eval.Normal
				},
				func(i int) error { return nil })

			// Request state=firing, rule_limit=7
			// Should fetch multiple pages to accumulate 7+ firing rules
			// Groups 1, 3, 5 = 6 rules (under limit)
			// Group 7 = +2 rules = 8 total (exceeds 7, but we include full group)
			req, err := http.NewRequest("GET", "/api/v1/rules?state=firing&rule_limit=7", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Count total firing rules returned
			totalRules := 0
			for _, rg := range res.Data.RuleGroups {
				for _, rule := range rg.Rules {
					require.Equal(t, "firing", rule.State)
					totalRules++
				}
			}

			// Should return 4 firing groups (1,3,5,7) with 8 rules total
			require.Equal(t, 8, totalRules)
			require.Equal(t, 4, len(res.Data.RuleGroups))
			require.NotEmpty(t, res.Data.NextToken)
		})

		t.Run("rule_limit with health filter", func(t *testing.T) {
			fakeStore, fakeAIM, api := setupAPI(t)

			// Create 8 groups (3 rules each = 24 rules total), alternating ok/error health
			// Error groups: 1,3,5,7 (4 groups × 3 rules = 12 error rules)
			// Request health=error with rule_limit=8 should return groups 1,3,5 (9 rules)
			createRulesWithState(t, fakeStore, fakeAIM, orgID, 8, 3,
				func(i int) eval.State { return eval.Normal },
				func(i int) error {
					if i%2 == 0 {
						return fmt.Errorf("evaluation error")
					}
					return nil
				})

			// Request health=error, rule_limit=8
			// Should fetch multiple pages to accumulate 8+ error rules
			// Groups 1, 3 = 6 rules (under limit)
			// Group 5 = +3 rules = 9 total (exceeds 8, but we include full group)
			req, err := http.NewRequest("GET", "/api/v1/rules?health=error&rule_limit=8", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: queryPermissions,
				},
			}

			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())

			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// Count total error rules returned
			totalRules := 0
			for _, rg := range res.Data.RuleGroups {
				for _, rule := range rg.Rules {
					require.Equal(t, "error", rule.Health)
					totalRules++
				}
			}

			// Should return 3 error groups (1,3,5) with 9 rules total
			require.Equal(t, 9, totalRules)
			require.Equal(t, 3, len(res.Data.RuleGroups))
			require.NotEmpty(t, res.Data.NextToken)
		})
	})

	t.Run("with search.folder filter", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)

		// Create folders with different paths
		folder1 := &folder.Folder{UID: "prod-uid", Title: "Production", Fullpath: "Production", OrgID: orgID}
		folder2 := &folder.Folder{UID: "prod-alerts-uid", Title: "Alerts", Fullpath: "Production/Alerts", OrgID: orgID}
		folder3 := &folder.Folder{UID: "dev-uid", Title: "Monitoring", Fullpath: "Development/Monitoring", OrgID: orgID}
		folder4 := &folder.Folder{UID: "prod-crit-uid", Title: "Critical", Fullpath: "Production/Critical", OrgID: orgID}
		fakeStore.Folders[orgID] = []*folder.Folder{folder1, folder2, folder3, folder4}

		// Create rules in different folders
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithNamespaceUID("prod-uid"), gen.WithUID("rule1"), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithNamespaceUID("prod-alerts-uid"), gen.WithUID("rule2"), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithNamespaceUID("dev-uid"), gen.WithUID("rule3"), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithNamespaceUID("prod-crit-uid"), gen.WithUID("rule4"), gen.WithNoNotificationSettings())

		testCases := []struct {
			name         string
			searchFolder string
			expectedUIDs []string
		}{
			{
				name:         "search 'production' matches Production folders",
				searchFolder: "production",
				expectedUIDs: []string{"rule1", "rule2", "rule4"},
			},
			{
				name:         "search 'prod alerts' matches Production/Alerts",
				searchFolder: "prod alerts",
				expectedUIDs: []string{"rule2"},
			},
			{
				name:         "search 'dev' matches Development",
				searchFolder: "dev",
				expectedUIDs: []string{"rule3"},
			},
			{
				name:         "search 'critical' matches Critical folder",
				searchFolder: "critical",
				expectedUIDs: []string{"rule4"},
			},
			{
				name:         "case insensitive search",
				searchFolder: "PRODUCTION",
				expectedUIDs: []string{"rule1", "rule2", "rule4"},
			},
			{
				name:         "empty search returns all rules",
				searchFolder: "",
				expectedUIDs: []string{"rule1", "rule2", "rule3", "rule4"},
			},
			{
				name:         "non-matching search returns no rules",
				searchFolder: "nonexistent",
				expectedUIDs: []string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				reqURL := "/api/v1/rules"
				if tc.searchFolder != "" {
					reqURL += "?search.folder=" + url.QueryEscape(tc.searchFolder)
				}
				req, err := http.NewRequest("GET", reqURL, nil)
				require.NoError(t, err)
				ctx := &contextmodel.ReqContext{
					Context:      &web.Context{Req: req},
					SignedInUser: &user.SignedInUser{OrgID: orgID, Permissions: queryPermissions},
				}

				resp := api.RouteGetRuleStatuses(ctx)
				require.Equal(t, http.StatusOK, resp.Status())

				var res apimodels.RuleResponse
				require.NoError(t, json.Unmarshal(resp.Body(), &res))
				require.Equal(t, "success", res.Status)

				// Collect rule UIDs from response
				actualUIDs := []string{}
				for _, group := range res.Data.RuleGroups {
					for _, rule := range group.Rules {
						actualUIDs = append(actualUIDs, rule.UID)
					}
				}

				require.ElementsMatch(t, tc.expectedUIDs, actualUIDs)
			})
		}
	})

	t.Run("with rule_matcher filter", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)

		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule1"), gen.WithLabels(map[string]string{"team": "alerting", "severity": "critical"}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule2"), gen.WithLabels(map[string]string{"team": "Alerting", "severity": "warning"}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule3"), gen.WithLabels(map[string]string{"team": "platform", "severity": "critical"}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule4"), gen.WithLabels(map[string]string{"env": "production"}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule_special"), gen.WithLabels(map[string]string{"key": `value"with"quotes`}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule_empty"), gen.WithLabels(map[string]string{"empty": ""}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule_nonempty"), gen.WithLabels(map[string]string{"empty": "nonempty"}), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule_multiline"), gen.WithLabels(map[string]string{"description": "line1\nline2\\end\"quote"}), gen.WithNoNotificationSettings())

		testCases := []struct {
			name         string
			matchers     []string
			expectedUIDs []string
		}{
			{
				name:         "equality matcher filters by team=alerting",
				matchers:     []string{`{"name":"team","value":"alerting","isRegex":false,"isEqual":true}`},
				expectedUIDs: []string{"rule1"},
			},
			{
				name:         "inequality matcher filters severity!=warning",
				matchers:     []string{`{"name":"severity","value":"warning","isRegex":false,"isEqual":false}`},
				expectedUIDs: []string{"rule1", "rule3", "rule4", "rule_special", "rule_empty", "rule_nonempty", "rule_multiline"},
			},
			{
				name:         "regex matcher filters team=~plat.*",
				matchers:     []string{`{"name":"team","value":"plat.*","isRegex":true,"isEqual":true}`},
				expectedUIDs: []string{"rule3"},
			},
			{
				name:         "not-regex matcher filters severity!~warn.*",
				matchers:     []string{`{"name":"severity","value":"warn.*","isRegex":true,"isEqual":false}`},
				expectedUIDs: []string{"rule1", "rule3", "rule4", "rule_special", "rule_empty", "rule_nonempty", "rule_multiline"},
			},
			{
				name: "multiple matchers are ANDed",
				matchers: []string{
					`{"name":"team","value":"alerting","isRegex":false,"isEqual":true}`,
					`{"name":"severity","value":"critical","isRegex":false,"isEqual":true}`,
				},
				expectedUIDs: []string{"rule1"},
			},
			{
				name:         "matcher with non-existent label returns no rules",
				matchers:     []string{`{"name":"nonexistent","value":"value","isRegex":false,"isEqual":true}`},
				expectedUIDs: []string{},
			},
			{
				name:         "equality matcher is case-sensitive",
				matchers:     []string{`{"name":"team","value":"Alerting","isRegex":false,"isEqual":true}`},
				expectedUIDs: []string{"rule2"},
			},
			{
				name:         "quotes in label value are handled correctly",
				matchers:     []string{`{"name":"key","value":"value\"with\"quotes","isRegex":false,"isEqual":true}`},
				expectedUIDs: []string{"rule_special"},
			},
			{
				name:         "no matchers returns all rules",
				matchers:     []string{},
				expectedUIDs: []string{"rule1", "rule2", "rule3", "rule4", "rule_special", "rule_empty", "rule_nonempty", "rule_multiline"},
			},
			{
				name:         "empty string value matches correctly",
				matchers:     []string{`{"name":"empty","value":"","isRegex":false,"isEqual":true}`},
				expectedUIDs: []string{"rule1", "rule2", "rule3", "rule4", "rule_special", "rule_empty", "rule_multiline"},
			},
			{
				name:         "special characters in label value are handled correctly",
				matchers:     []string{`{"name":"description","value":"line1\nline2\\end\"quote","isRegex":false,"isEqual":true}`},
				expectedUIDs: []string{"rule_multiline"},
			},
			{
				name:         "inequality matcher on non-existent label matches all rules",
				matchers:     []string{`{"name":"nonexistent","value":"value","isRegex":false,"isEqual":false}`},
				expectedUIDs: []string{"rule1", "rule2", "rule3", "rule4", "rule_special", "rule_empty", "rule_nonempty", "rule_multiline"},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				reqURL := "/api/v1/rules"
				for i, matcher := range tc.matchers {
					if i == 0 {
						reqURL += "?rule_matcher=" + url.QueryEscape(matcher)
					} else {
						reqURL += "&rule_matcher=" + url.QueryEscape(matcher)
					}
				}

				req, err := http.NewRequest("GET", reqURL, nil)
				require.NoError(t, err)
				ctx := &contextmodel.ReqContext{
					Context:      &web.Context{Req: req},
					SignedInUser: &user.SignedInUser{OrgID: orgID, Permissions: queryPermissions},
				}

				resp := api.RouteGetRuleStatuses(ctx)
				require.Equal(t, http.StatusOK, resp.Status())

				var res apimodels.RuleResponse
				require.NoError(t, json.Unmarshal(resp.Body(), &res))
				require.Equal(t, "success", res.Status)

				actualUIDs := []string{}
				for _, group := range res.Data.RuleGroups {
					for _, rule := range group.Rules {
						actualUIDs = append(actualUIDs, rule.UID)
					}
				}

				require.ElementsMatch(t, tc.expectedUIDs, actualUIDs)
			})
		}
	})

	t.Run("pagination with rule_matcher in-memory filtering", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)

		// Create 3 groups with 2 rules each:
		// Group 1 & 2: team=backend (won't match filter)
		// Group 3: team=frontend (will match filter)
		// This tests that pagination continues fetching when early pages are filtered out

		group1Key := ngmodels.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "namespace1", RuleGroup: "group1"}
		group2Key := ngmodels.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "namespace2", RuleGroup: "group2"}
		group3Key := ngmodels.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "namespace3", RuleGroup: "group3"}

		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule1"), gen.WithLabels(map[string]string{"team": "security"}), gen.WithGroupKey(group1Key), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule2"), gen.WithLabels(map[string]string{"team": "security"}), gen.WithGroupKey(group1Key), gen.WithNoNotificationSettings())

		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule3"), gen.WithLabels(map[string]string{"team": "security"}), gen.WithGroupKey(group2Key), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule4"), gen.WithLabels(map[string]string{"team": "security"}), gen.WithGroupKey(group2Key), gen.WithNoNotificationSettings())

		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule5"), gen.WithLabels(map[string]string{"team": "alerting"}), gen.WithGroupKey(group3Key), gen.WithNoNotificationSettings())
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery(),
			gen.WithUID("rule6"), gen.WithLabels(map[string]string{"team": "alerting"}), gen.WithGroupKey(group3Key), gen.WithNoNotificationSettings())

		// Request with regex rule_matcher filter for team=~"alerting" and group_limit=1 to force pagination
		matcher := `{"name":"team","value":"alerting","isRegex":true,"isEqual":true}`
		reqURL := "/api/v1/rules?rule_matcher=" + url.QueryEscape(matcher) + "&group_limit=1"

		req, err := http.NewRequest("GET", reqURL, nil)
		require.NoError(t, err)
		ctx := &contextmodel.ReqContext{
			Context:      &web.Context{Req: req},
			SignedInUser: &user.SignedInUser{OrgID: orgID, Permissions: queryPermissions},
		}

		resp := api.RouteGetRuleStatuses(ctx)
		require.Equal(t, http.StatusOK, resp.Status())

		var res apimodels.RuleResponse
		require.NoError(t, json.Unmarshal(resp.Body(), &res))
		require.Equal(t, "success", res.Status)

		actualUIDs := []string{}
		for _, group := range res.Data.RuleGroups {
			for _, rule := range group.Rules {
				actualUIDs = append(actualUIDs, rule.UID)
			}
		}

		// Should return group3 rules (rule5, rule6), pagination should continue past filtered groups
		require.ElementsMatch(t, []string{"rule5", "rule6"}, actualUIDs)
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
