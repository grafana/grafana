package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"math/rand"
	"net/http"
	"testing"
	"time"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"

	"github.com/grafana/grafana/pkg/infra/log"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
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
				Results: []state.Evaluation{
					{Condition: "A", Values: map[string]*float64{}},
				},
			},
			expected: "[ var='A' metric='vector(10) + time() % 50' labels={} value=1.1 ]",
		},
		{
			name: "with one value, it renders the single value",
			alertState: &state.State{
				LastEvaluationString: "[ var='A' metric='vector(10) + time() % 50' labels={} value=1.1 ]",
				Results: []state.Evaluation{
					{Condition: "A", Values: map[string]*float64{"A": &val1}},
				},
			},
			expected: "1.1e+00",
		},
		{
			name: "with two values, it renders the value based on their refID and position",
			alertState: &state.State{
				LastEvaluationString: "[ var='B0' metric='vector(10) + time() % 50' labels={} value=1.1 ], [ var='B1' metric='vector(10) + time() % 50' labels={} value=1.4 ]",
				Results: []state.Evaluation{
					{Condition: "B", Values: map[string]*float64{"B0": &val1, "B1": &val2}},
				},
			},
			expected: "B0: 1.1e+00, B1: 1.4e+00",
		},
		{
			name: "with a high number of values, it renders the value based on their refID and position using a natural order",
			alertState: &state.State{
				LastEvaluationString: "[ var='B0' metric='vector(10) + time() % 50' labels={} value=1.1 ], [ var='B1' metric='vector(10) + time() % 50' labels={} value=1.4 ]",
				Results: []state.Evaluation{
					{Condition: "B", Values: map[string]*float64{"B0": &val1, "B1": &val2, "B2": &val1, "B10": &val2, "B11": &val1}},
				},
			},
			expected: "B0: 1.1e+00, B10: 1.4e+00, B11: 1.1e+00, B1: 1.4e+00, B2: 1.1e+00",
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, formatValues(tt.alertState))
		})
	}
}

func TestRouteGetAlertStatuses(t *testing.T) {
	orgID := int64(1)

	t.Run("with no alerts", func(t *testing.T) {
		_, _, _, api := setupAPI(t)
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
		_, fakeAIM, _, api := setupAPI(t)
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
		_, fakeAIM, _, api := setupAPI(t)
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

	t.Run("with the inclusion of internal labels", func(t *testing.T) {
		_, fakeAIM, _, api := setupAPI(t)
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
		value := float64(1.1)
		s.Results = append(s.Results, state.Evaluation{
			EvaluationState: eval.Alerting,
			EvaluationTime:  timeNow(),
			Values:          map[string]*float64{"B": &value},
			Condition:       "B",
		})
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

func TestRouteGetRuleStatuses(t *testing.T) {
	timeNow = func() time.Time { return time.Date(2022, 3, 10, 14, 0, 0, 0, time.UTC) }
	orgID := int64(1)

	req, err := http.NewRequest("GET", "/api/v1/rules", nil)
	require.NoError(t, err)
	c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer}}

	t.Run("with no rules", func(t *testing.T) {
		_, _, _, api := setupAPI(t)
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
		fakeStore, fakeAIM, _, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery())
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
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "vector(1)",
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
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
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
`, folder.Title), string(r.Body()))
	})

	t.Run("with the inclusion of internal Labels", func(t *testing.T) {
		fakeStore, fakeAIM, _, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery())
		folder := fakeStore.Folders[orgID][0]

		req, err := http.NewRequest("GET", "/api/v1/rules?includeInternalLabels=true", nil)
		require.NoError(t, err)
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer}}

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "%s",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "vector(1)",
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
				"labels": {
					"__a_private_label_on_the_rule__": "a_value",
					"__alert_rule_uid__": "RuleUID"
				},
				"health": "ok",
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
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
`, folder.Title), string(r.Body()))
	})

	t.Run("with a rule that has multiple queries", func(t *testing.T) {
		fakeStore, fakeAIM, _, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withExpressionsMultiQuery())
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
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "vector(1) | vector(1)",
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
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
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
`, folder.Title), string(r.Body()))
	})

	t.Run("with many rules in a group", func(t *testing.T) {
		t.Run("should return sorted", func(t *testing.T) {
			ruleStore := fakes.NewRuleStore(t)
			fakeAIM := NewFakeAlertInstanceManager(t)
			groupKey := ngmodels.GenerateGroupKey(orgID)
			_, rules := ngmodels.GenerateUniqueAlertRules(rand.Intn(5)+5, ngmodels.AlertRuleGen(withGroupKey(groupKey), ngmodels.WithUniqueGroupIndex()))
			ruleStore.PutRule(context.Background(), rules...)

			api := PrometheusSrv{
				log:     log.NewNopLogger(),
				manager: fakeAIM,
				store:   ruleStore,
				ac:      acmock.New().WithDisabled(),
			}

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

	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		t.Run("should return only rules if the user can query all data sources", func(t *testing.T) {
			ruleStore := fakes.NewRuleStore(t)
			fakeAIM := NewFakeAlertInstanceManager(t)

			rules := ngmodels.GenerateAlertRules(rand.Intn(4)+2, ngmodels.AlertRuleGen(withOrgID(orgID)))
			ruleStore.PutRule(context.Background(), rules...)
			ruleStore.PutRule(context.Background(), ngmodels.GenerateAlertRules(rand.Intn(4)+2, ngmodels.AlertRuleGen(withOrgID(orgID)))...)

			acMock := acmock.New().WithPermissions(createPermissionsForRules(rules))

			api := PrometheusSrv{
				log:     log.NewNopLogger(),
				manager: fakeAIM,
				store:   ruleStore,
				ac:      acMock,
			}

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
		fakeStore, fakeAIM, _, api := setupAPI(t)
		// Create rules in the same Rule Group to keep assertions simple
		rules := ngmodels.GenerateAlertRules(3, ngmodels.AlertRuleGen(withOrgID(orgID), withGroup("Rule-Group-1"), withNamespace(&folder.Folder{
			Title: "Folder-1",
		})))
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
				OrgID:   orgID,
				OrgRole: org.RoleViewer,
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
		require.Len(t, r1.Alerts, 2)
		// The second rule should have an alerting alert
		r2 := rg.Rules[1]
		require.Equal(t, map[string]int64{"alerting": 1, "error": 1}, r2.Totals)
		require.Len(t, r2.Alerts, 1)
		// The last rule should have an error alert
		r3 := rg.Rules[2]
		require.Equal(t, map[string]int64{"error": 1}, r3.Totals)
		require.Len(t, r3.Alerts, 1)
	})

	t.Run("test time of first firing alert", func(t *testing.T) {
		fakeStore, fakeAIM, _, api := setupAPI(t)
		// Create rules in the same Rule Group to keep assertions simple
		rules := ngmodels.GenerateAlertRules(1, ngmodels.AlertRuleGen(withOrgID(orgID)))
		fakeStore.PutRule(context.Background(), rules...)

		getRuleResponse := func() apimodels.RuleResponse {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
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
		fakeStore, _, _, api := setupAPI(t)

		rules := ngmodels.GenerateAlertRules(2, ngmodels.AlertRuleGen(withOrgID(orgID)))
		fakeStore.PutRule(context.Background(), rules...)

		t.Run("first without limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
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
			r, err := http.NewRequest("GET", "/api/v1/rules?limit=1", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 inactive rules across all Rule Groups
			require.Equal(t, map[string]int64{"inactive": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			// The Rule Group within the limit should have 1 inactive rule
			require.Equal(t, map[string]int64{"inactive": 1}, rg.Totals)
			require.Len(t, rg.Rules, 1)
		})
	})

	t.Run("test with limit rules", func(t *testing.T) {
		fakeStore, _, _, api := setupAPI(t)
		rules := ngmodels.GenerateAlertRules(2, ngmodels.AlertRuleGen(withOrgID(orgID), withGroup("Rule-Group-1")))
		fakeStore.PutRule(context.Background(), rules...)

		t.Run("first without limit", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
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
			r, err := http.NewRequest("GET", "/api/v1/rules?limit=1&limit_rules=1", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
				},
			}
			resp := api.RouteGetRuleStatuses(c)
			require.Equal(t, http.StatusOK, resp.Status())
			var res apimodels.RuleResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &res))

			// There should be 2 inactive rules
			require.Equal(t, map[string]int64{"inactive": 2}, res.Data.Totals)
			require.Len(t, res.Data.RuleGroups, 1)
			rg := res.Data.RuleGroups[0]
			// The Rule Group within the limit should have 1 inactive rule because of the limit
			require.Equal(t, map[string]int64{"inactive": 1}, rg.Totals)
			require.Len(t, rg.Rules, 1)
		})
	})

	t.Run("test with limit alerts", func(t *testing.T) {
		fakeStore, fakeAIM, _, api := setupAPI(t)
		rules := ngmodels.GenerateAlertRules(2, ngmodels.AlertRuleGen(withOrgID(orgID), withGroup("Rule-Group-1")))
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
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
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
			}
		})

		t.Run("then with limits", func(t *testing.T) {
			r, err := http.NewRequest("GET", "/api/v1/rules?limit=1&limit_rules=1&limit_alerts=1", nil)
			require.NoError(t, err)
			c := &contextmodel.ReqContext{
				Context: &web.Context{Req: r},
				SignedInUser: &user.SignedInUser{
					OrgID:   orgID,
					OrgRole: org.RoleViewer,
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
			require.Len(t, rule.Alerts, 1)
			// Firing alerts should have precedence over normal alerts
			require.Equal(t, "Alerting", rule.Alerts[0].State)
		})
	})
}

func setupAPI(t *testing.T) (*fakes.RuleStore, *fakeAlertInstanceManager, *acmock.Mock, PrometheusSrv) {
	fakeStore := fakes.NewRuleStore(t)
	fakeAIM := NewFakeAlertInstanceManager(t)
	acMock := acmock.New().WithDisabled()

	api := PrometheusSrv{
		log:     log.NewNopLogger(),
		manager: fakeAIM,
		store:   fakeStore,
		ac:      acMock,
	}

	return fakeStore, fakeAIM, acMock, api
}

func generateRuleAndInstanceWithQuery(t *testing.T, orgID int64, fakeAIM *fakeAlertInstanceManager, fakeStore *fakes.RuleStore, query func(r *ngmodels.AlertRule)) {
	t.Helper()

	rules := ngmodels.GenerateAlertRules(1, ngmodels.AlertRuleGen(withOrgID(orgID), asFixture(), query))

	fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, func(s *state.State) *state.State {
		s.Labels = data.Labels{
			"job":                            "prometheus",
			alertingModels.NamespaceUIDLabel: "test_namespace_uid",
			alertingModels.RuleUIDLabel:      "test_alert_rule_uid_0",
		}
		s.Annotations = data.Labels{"severity": "critical"}
		return s
	})

	for _, r := range rules {
		fakeStore.PutRule(context.Background(), r)
	}
}

// asFixture removes variable values of the alert rule.
// we're not too interested in variability of the rule in this scenario.
func asFixture() func(r *ngmodels.AlertRule) {
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
	}
}

func withClassicConditionSingleQuery() func(r *ngmodels.AlertRule) {
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

func withExpressionsMultiQuery() func(r *ngmodels.AlertRule) {
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
