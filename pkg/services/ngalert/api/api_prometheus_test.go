package api

import (
	"context"
	"encoding/json"
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
	fakeStore := store.NewFakeRuleStore(t)
	fakeAlertInstanceManager := NewFakeAlertInstanceManager(t)
	orgID := int64(1)

	api := PrometheusSrv{
		log:     log.NewNopLogger(),
		manager: fakeAlertInstanceManager,
		store:   fakeStore,
	}

	c := &models.ReqContext{SignedInUser: &models.SignedInUser{OrgId: orgID}}

	t.Run("with no alerts", func(t *testing.T) {
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
		fakeAlertInstanceManager.GenerateAlertInstances(1, util.GenerateShortUID(), 2)
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
	fakeStore := store.NewFakeRuleStore(t)
	fakeAIM := NewFakeAlertInstanceManager(t)
	orgID := int64(1)
	api := PrometheusSrv{
		log:     log.NewNopLogger(),
		manager: fakeAIM,
		store:   fakeStore,
	}

	req, err := http.NewRequest("GET", "/api/v1/rules", nil)
	require.NoError(t, err)
	c := &models.ReqContext{Context: &web.Context{Req: req}, SignedInUser: &models.SignedInUser{OrgId: orgID}}

	t.Run("with no rules", func(t *testing.T) {
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

	t.Run("with some rules", func(t *testing.T) {
		generateRuleAndInstanceWithQuery(t, orgID, fakeAIM, fakeStore, withSingleQuery())

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
				"query": "[{\"refId\":\"QueryRefID\",\"queryType\":\"prometheus\",\"relativeTimeRange\":{\"from\":3e-7,\"to\":0},\"datasourceUid\":\"QueryDatasourceUID\",\"model\":[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":300,\"to\":0},\"datasourceUid\":\"P17AB2139481E68BC\",\"model\":{\"expr\":\"go_goroutines\",\"format\":\"time_series\",\"intervalFactor\":1,\"refId\":\"A\"}},{\"refId\":\"B\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":0,\"to\":0},\"datasourceUid\":\"-100\",\"model\":{\"type\":\"classic_conditions\",\"refId\":\"B\",\"conditions\":[{\"evaluator\":{\"params\":[65],\"type\":\"gt\"},\"operator\":{\"type\":\"and\"},\"query\":{\"params\":[\"A\"]},\"reducer\":{\"type\":\"avg\"}}]}}]}]",
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
				"labels": null,
				"health": "ok",
				"lastError": "",
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

func generateRuleAndInstanceWithQuery(t *testing.T, orgID int64, fakeAIM *fakeAlertInstanceManager, fakeStore *store.FakeRuleStore, query func(r *ngmodels.AlertRule)) {
	t.Helper()

	rules := ngmodels.GenerateAlertRules(1, ngmodels.AlertRuleGen(withOrgID(orgID), asAFixture(), query))

	fakeAIM.GenerateAlertInstances(orgID, rules[0].UID, 1, func(s *state.State) *state.State {
		s.Labels = data.Labels{"job": "prometheus"}
		s.Annotations = data.Labels{"severity": "critical"}
		return s
	})

	for _, r := range rules {
		fakeStore.PutRule(context.Background(), r)
	}
}

// asAFixture removes variable values of the alert rule.
// we're not too interested in variability of the rule in this scenario.
func asAFixture() func(r *ngmodels.AlertRule) {
	return func(r *ngmodels.AlertRule) {
		r.Title = "AlwaysFiring"
		r.NamespaceUID = "namespaceUID"
		r.RuleGroup = "rule-group"
		r.UID = "RuleUID"
		r.Labels = nil
		r.Annotations = nil
		r.IntervalSeconds = 60
		r.For = 180 * time.Second
	}
}

func withSingleQuery() func(r *ngmodels.AlertRule) {
	return func(r *ngmodels.AlertRule) {
		queries := []ngmodels.AlertQuery{
			{
				DatasourceUID: "QueryDatasourceUID",
				Model:         json.RawMessage(PrometheusModelQueryFixture),
				RelativeTimeRange: ngmodels.RelativeTimeRange{
					From: ngmodels.Duration(300),
					To:   ngmodels.Duration(0),
				},
				RefID:     "QueryRefID",
				QueryType: "prometheus",
			},
		}

		r.Data = queries
	}
}

const randomWalkQueryFixture = `
[{
	"refId": "A",
	"queryType": "",
	"relativeTimeRange": {
		"from": 300,
		"to": 0
	},
	"datasourceUid": "ehkoACGnz",
	"model": {
		"refId": "A",
		"scenarioId": "slow_query",
		"stringInput": "5s"
	}
}, {
	"refId": "B",
	"queryType": "",
	"relativeTimeRange": {
		"from": 0,
		"to": 0
	},
	"datasourceUid": "-100",
	"model": {
		"type": "classic_conditions",
		"refId": "B",
		"conditions": [{
			"evaluator": {
				"params": [20],
				"type": "gt"
			},
			"operator": {
				"type": "and"
			},
			"query": {
				"params": ["A"]
			},
			"reducer": {
				"type": "avg"
			}
		}]
	}
}]
`

const PrometheusModelQueryFixture = `
[{
	"refId": "A",
	"queryType": "",
	"relativeTimeRange": {
		"from": 300,
		"to": 0
	},
	"datasourceUid": "P17AB2139481E68BC",
	"model": {
		"expr": "go_goroutines",
		"format": "time_series",
		"intervalFactor": 1,
		"refId": "A"
	}
}, {
	"refId": "B",
	"queryType": "",
	"relativeTimeRange": {
		"from": 0,
		"to": 0
	},
	"datasourceUid": "-100",
	"model": {
		"type": "classic_conditions",
		"refId": "B",
		"conditions": [{
			"evaluator": {
				"params": [65],
				"type": "gt"
			},
			"operator": {
				"type": "and"
			},
			"query": {
				"params": ["A"]
			},
			"reducer": {
				"type": "avg"
			}
		}]
	}
}]
`
