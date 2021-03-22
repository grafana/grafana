package api

import (
	"net/http"
	"time"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

type PrometheusApiMock struct {
	log log.Logger
}

func (mock PrometheusApiMock) RouteGetAlertStatuses(c *models.ReqContext) response.Response {
	recipient := c.Params(":Recipient")
	mock.log.Info("RouteGetAlertStatuses: ", "Recipient", recipient)
	now := time.Now()
	result := apimodels.AlertResponse{
		Data: apimodels.AlertDiscovery{
			Alerts: []*apimodels.Alert{
				{
					Labels: map[string]string{
						"label 1": "value 1",
						"label 2": "value 2",
					},
					Annotations: map[string]string{
						"alert annotation 1": "value 1",
						"alert annotation 2": "value 2",
					},
					State:    "firing",
					ActiveAt: &now,
					Value:    "",
				},
				{
					Labels: map[string]string{
						"label 1-2": "value 1",
						"label 2-2": "value 2",
					},
					Annotations: map[string]string{
						"alert annotation 1-2": "value 1",
						"alert annotation 2-2": "value 2",
					},
					State:    "inactive",
					ActiveAt: &now,
					Value:    "",
				},
			},
		},
	}
	return response.JSON(http.StatusOK, result)
}

func (mock PrometheusApiMock) RouteGetRuleStatuses(c *models.ReqContext) response.Response {
	recipient := c.Params(":Recipient")
	mock.log.Info("RouteGetRuleStatuses: ", "Recipient", recipient)
	now := time.Now()
	result := apimodels.RuleResponse{
		Data: apimodels.RuleDiscovery{
			RuleGroups: []*apimodels.RuleGroup{
				{
					Name:           "group1",
					Interval:       60,
					LastEvaluation: now.Add(-time.Minute),
					EvaluationTime: 1,
					Rules: []apimodels.AlertingRule{
						{
							State: "firing",
							Name:  "rule 1-1",
							Query: `{
								"title": "rule 1-1",
								"condition": "A",
								"data": [
								  {
									"refId": "A",
									"queryType": "",
									"relativeTimeRange": {
									  "from": 18000,
									  "to": 10800
									},
									"model": {
									  "datasource": "__expr__",
									  "type": "math",
									  "expression": "2 + 2 > 1"
									}
								  }
								],
								"no_data_state": "NoData",
								"exec_err_state": "Alerting"
							  }`,
							Duration: 600,
							Annotations: map[string]string{
								"annotation 1": "value 1",
								"annotation 2": "value 2",
							},
							Alerts: []*apimodels.Alert{
								{
									Labels: map[string]string{
										"label 1": "value 1",
										"label 2": "value 2",
									},
									Annotations: map[string]string{
										"alert annotation 1": "value 1",
										"alert annotation 2": "value 2",
									},
									State:    "firing",
									ActiveAt: &now,
									Value:    "",
								},
								{
									Labels: map[string]string{
										"label 1-2": "value 1",
										"label 2-2": "value 2",
									},
									Annotations: map[string]string{
										"alert annotation 1-2": "value 1",
										"alert annotation 2-2": "value 2",
									},
									State:    "inactive",
									ActiveAt: &now,
									Value:    "",
								},
							},
						},
					},
				},
			},
		},
	}
	return response.JSON(http.StatusOK, result)
}
