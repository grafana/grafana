package api

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acMock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/eval/eval_mocks"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func Test(t *testing.T) {
	text := `{
    "rule": {
"grafana_alert" : {
        "condition": "C",
        "data": [
            {
                "refId": "A",
                "relativeTimeRange": {
                    "from": 600,
                    "to": 0
                },
                "queryType": "",
                "datasourceUid": "PD8C576611E62080A",
                "model": {
                    "refId": "A",
                    "hide": false,
                    "datasource": {
                        "type": "testdata",
                        "uid": "PD8C576611E62080A"
                    },
                    "scenarioId": "random_walk",
                    "seriesCount": 5,
                    "labels": "series=series-$seriesIndex"
                }
            },
            {
                "refId": "B",
                "datasourceUid": "__expr__",
                "queryType": "",
                "model": {
                    "refId": "B",
                    "hide": false,
                    "type": "reduce",
                    "datasource": {
                        "uid": "__expr__",
                        "type": "__expr__"
                    },
                    "reducer": "last",
                    "expression": "A"
                },
                "relativeTimeRange": {
                    "from": 600,
                    "to": 0
                }
            },
            {
                "refId": "C",
                "datasourceUid": "__expr__",
                "queryType": "",
                "model": {
                    "refId": "C",
                    "hide": false,
                    "type": "threshold",
                    "datasource": {
                        "uid": "__expr__",
                        "type": "__expr__"
                    },
                    "conditions": [
                        {
                            "type": "query",
                            "evaluator": {
                                "params": [
                                    0
                                ],
                                "type": "gt"
                            }
                        }
                    ],
                    "expression": "B"
                },
                "relativeTimeRange": {
                    "from": 600,
                    "to": 0
                }
            }
        ],
        "no_data_state": "Alerting",
"title": "string"
},
        "for": "0s",
        "labels": {
            "additionalProp1": "string",
            "additionalProp2": "string",
            "additionalProp3": "string"
        },
 "annotations": {
            "additionalProp1": "string",
            "additionalProp2": "string",
            "additionalProp3": "string"
        }
    },
    "folderUid": "test-uid",
    "folderTitle": "test-folder"
}`
	var conf definitions.PostableExtendedRuleNodeExtended
	require.NoError(t, json.Unmarshal([]byte(text), &conf))

	require.Equal(t, "test-folder", conf.NamespaceTitle)
}

func TestRouteTestGrafanaRuleConfig(t *testing.T) {
	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		rc := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}

		t.Run("should return 401 if user cannot query a data source", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()
			data2 := models.GenerateAlertQuery()

			ac := acMock.New().WithPermissions([]accesscontrol.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data1.DatasourceUID)},
			})

			srv := createTestingApiSrv(t, nil, ac, eval_mocks.NewEvaluatorFactory(&eval_mocks.ConditionEvaluatorMock{}))

			rule := validRule()
			rule.GrafanaManagedAlert.Data = ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2})
			rule.GrafanaManagedAlert.Condition = data2.RefID
			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.PostableExtendedRuleNodeExtended{
				Rule:           rule,
				NamespaceUID:   "test-folder",
				NamespaceTitle: "test-folder",
			})

			require.Equal(t, http.StatusUnauthorized, response.Status())
		})

		t.Run("should return 200 if user can query all data sources", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()
			data2 := models.GenerateAlertQuery()

			ac := acMock.New().WithPermissions([]accesscontrol.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data1.DatasourceUID)},
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data2.DatasourceUID)},
			})

			ds := &fakes.FakeCacheService{DataSources: []*datasources.DataSource{
				{UID: data1.DatasourceUID},
				{UID: data2.DatasourceUID},
			}}

			var result []eval.Result
			evaluator := &eval_mocks.ConditionEvaluatorMock{}
			evaluator.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(result, nil)

			evalFactory := eval_mocks.NewEvaluatorFactory(evaluator)

			srv := createTestingApiSrv(t, ds, ac, evalFactory)

			rule := validRule()
			rule.GrafanaManagedAlert.Data = ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2})
			rule.GrafanaManagedAlert.Condition = data2.RefID
			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.PostableExtendedRuleNodeExtended{
				Rule:           rule,
				NamespaceUID:   "test-folder",
				NamespaceTitle: "test-folder",
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "Evaluate", mock.Anything, mock.Anything)
		})
	})
}

func TestRouteEvalQueries(t *testing.T) {
	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		rc := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}

		t.Run("should return 401 if user cannot query a data source", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()
			data2 := models.GenerateAlertQuery()

			ac := acMock.New().WithPermissions([]accesscontrol.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data1.DatasourceUID)},
			})

			srv := &TestingApiSrv{
				accessControl: ac,
			}

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
				Now:  time.Time{},
			})

			require.Equal(t, http.StatusUnauthorized, response.Status())
		})

		t.Run("should return 200 if user can query all data sources", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()
			data2 := models.GenerateAlertQuery()

			currentTime := time.Now()

			ac := acMock.New().WithPermissions([]accesscontrol.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data1.DatasourceUID)},
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data2.DatasourceUID)},
			})

			ds := &fakes.FakeCacheService{DataSources: []*datasources.DataSource{
				{UID: data1.DatasourceUID},
				{UID: data2.DatasourceUID},
			}}

			evaluator := &eval_mocks.ConditionEvaluatorMock{}
			result := &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"test": {
						Frames: nil,
						Error:  nil,
					},
				},
			}
			evaluator.EXPECT().EvaluateRaw(mock.Anything, mock.Anything).Return(result, nil)

			srv := createTestingApiSrv(t, ds, ac, eval_mocks.NewEvaluatorFactory(evaluator))

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
				Now:  currentTime,
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "EvaluateRaw", mock.Anything, currentTime)
		})
	})
}

func createTestingApiSrv(t *testing.T, ds *fakes.FakeCacheService, ac *acMock.Mock, evaluator eval.EvaluatorFactory) *TestingApiSrv {
	if ac == nil {
		ac = acMock.New().WithDisabled()
	}

	return &TestingApiSrv{
		DatasourceCache: ds,
		accessControl:   ac,
		evaluator:       evaluator,
		cfg:             config(t),
	}
}
