package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestRouteGetAlertStatuses(t *testing.T) {
	orgID := int64(1)

	t.Run("with no alerts", func(t *testing.T) {
		_, _, api := setupAPI(t)
		req, err := http.NewRequest("GET", "/api/v1/alerts", nil)
		require.NoError(t, err)
		c := &models.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &models.SignedInUser{OrgId: orgID}}

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
		c := &models.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &models.SignedInUser{OrgId: orgID}}

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

	t.Run("with the inclusion of internal labels", func(t *testing.T) {
		_, fakeAIM, api := setupAPI(t)
		fakeAIM.GenerateAlertInstances(orgID, util.GenerateShortUID(), 2)
		req, err := http.NewRequest("GET", "/api/v1/alerts?includeInternalLabels=true", nil)
		require.NoError(t, err)
		c := &models.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &models.SignedInUser{OrgId: orgID}}

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

func TestRouteGetRuleStatuses(t *testing.T) {
	timeNow = func() time.Time { return time.Date(2022, 3, 10, 14, 0, 0, 0, time.UTC) }
	orgID := int64(1)

	req, err := http.NewRequest("GET", "/api/v1/rules", nil)
	require.NoError(t, err)
	c := &models.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &models.SignedInUser{OrgId: orgID}}

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
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery())

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "namespaceUID",
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
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
				"evaluationTime": 60
			}],
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 0
		}]
	}
}
`, string(r.Body()))
	})

	t.Run("with the inclusion of internal Labels", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withClassicConditionSingleQuery())

		req, err := http.NewRequest("GET", "/api/v1/rules?includeInternalLabels=true", nil)
		require.NoError(t, err)
		c := &models.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &models.SignedInUser{OrgId: orgID}}

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "namespaceUID",
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
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 0
		}]
	}
}
`, string(r.Body()))
	})

	t.Run("with a rule that has multiple queries", func(t *testing.T) {
		fakeStore, fakeAIM, api := setupAPI(t)
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withExpressionsMultiQuery())

		r := api.RouteGetRuleStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "rule-group",
			"file": "namespaceUID",
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
				"labels": {
					"__a_private_label_on_the_rule__": "a_value"
				},
				"health": "ok",
				"type": "alerting",
				"lastEvaluation": "2022-03-10T14:01:00Z",
				"duration": 180,
				"evaluationTime": 60
			}],
			"interval": 60,
			"lastEvaluation": "2022-03-10T14:01:00Z",
			"evaluationTime": 0
		}]
	}
}
`, string(r.Body()))
	})
}

func setupAPI(t *testing.T) (*store.FakeRuleStore, *fakeAlertInstanceManager, PrometheusSrv) {
	fakeStore := store.NewFakeRuleStore(t)
	fakeAIM := NewFakeAlertInstanceManager(t)
	api := PrometheusSrv{
		log:     log.NewNopLogger(),
		manager: fakeAIM,
		store:   fakeStore,
	}

	return fakeStore, fakeAIM, api
}

func generateRuleAndInstanceWithQuery(t *testing.T, orgID int64, fakeAIM *fakeAlertInstanceManager, fakeStore *store.FakeRuleStore, query func(r *ngmodels.AlertRule)) {
	t.Helper()

	rules := ngmodels.GenerateAlertRules(1, ngmodels.AlertRuleGen(withOrgID(orgID), asFixture(), query))

	fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, func(s *state.State) *state.State {
		s.Labels = data.Labels{
			"job":                      "prometheus",
			ngmodels.NamespaceUIDLabel: "test_namespace_uid",
			ngmodels.RuleUIDLabel:      "test_alert_rule_uid_0",
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
			ngmodels.RuleUIDLabel:             "RuleUID",
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
				DatasourceUID:     "-100",
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
				DatasourceUID:     "-100",
				Model:             json.RawMessage(fmt.Sprintf(reduceLastExpressionModel, "A", "C")),
			},
			{
				RefID:             "D",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     "-100",
				Model:             json.RawMessage(fmt.Sprintf(reduceLastExpressionModel, "B", "D")),
			},
			{
				RefID:             "E",
				QueryType:         "",
				RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(0), To: ngmodels.Duration(0)},
				DatasourceUID:     "-100",
				Model:             json.RawMessage(fmt.Sprintf(mathExpressionModel, "A", "B", "E")),
			},
		}
		r.Data = queries
	}
}
