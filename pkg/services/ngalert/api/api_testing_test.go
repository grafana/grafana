package api

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acMock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	. "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/eval/eval_mocks"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	fakes2 "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
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

		t.Run("should return Forbidden if user cannot access folder", func(t *testing.T) {
			ac := acMock.New().WithPermissions([]ac.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceAllScope()},
			})

			ruleStore := fakes2.NewRuleStore(t)
			ruleStore.Hook = func(cmd any) error {
				q, ok := cmd.(fakes2.GenericRecordedQuery)
				if !ok {
					return nil
				}
				if q.Name == "GetNamespaceByUID" {
					return dashboards.ErrFolderAccessDenied
				}
				return nil
			}

			srv := createTestingApiSrv(t, nil, ac, eval_mocks.NewEvaluatorFactory(&eval_mocks.ConditionEvaluatorMock{}), featuremgmt.WithFeatures(), ruleStore)

			rule := validRule()

			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.PostableExtendedRuleNodeExtended{
				Rule:           rule,
				NamespaceUID:   uuid.NewString(),
				NamespaceTitle: "test-folder",
			})

			require.Equal(t, http.StatusForbidden, response.Status())
		})

		t.Run("should return Forbidden if user cannot query a data source", func(t *testing.T) {
			gen := models.RuleGen
			data1 := gen.GenerateQuery()
			data2 := gen.GenerateQuery()

			ac := acMock.New().WithPermissions([]ac.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data1.DatasourceUID)},
			})

			f := randFolder()
			ruleStore := fakes2.NewRuleStore(t)
			ruleStore.Folders[rc.OrgID] = []*folder.Folder{f}
			srv := createTestingApiSrv(t, nil, ac, eval_mocks.NewEvaluatorFactory(&eval_mocks.ConditionEvaluatorMock{}), featuremgmt.WithFeatures(), ruleStore)

			rule := validRule()
			rule.GrafanaManagedAlert.Data = ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2})
			rule.GrafanaManagedAlert.Condition = data2.RefID
			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.PostableExtendedRuleNodeExtended{
				Rule:           rule,
				NamespaceUID:   f.UID,
				NamespaceTitle: f.Title,
			})

			t.Log(string(response.Body()))
			require.Equal(t, http.StatusForbidden, response.Status())
		})

		t.Run("should return 200 if user can query all data sources", func(t *testing.T) {
			gen := models.RuleGen
			data1 := gen.GenerateQuery()
			data2 := gen.GenerateQuery()

			ac := acMock.New().WithPermissions([]ac.Permission{
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

			f := randFolder()
			ruleStore := fakes2.NewRuleStore(t)
			ruleStore.Folders[rc.OrgID] = []*folder.Folder{f}

			srv := createTestingApiSrv(t, ds, ac, evalFactory, featuremgmt.WithFeatures(), ruleStore)

			rule := validRule()
			rule.GrafanaManagedAlert.Data = ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2})
			rule.GrafanaManagedAlert.Condition = data2.RefID
			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.PostableExtendedRuleNodeExtended{
				Rule:           rule,
				NamespaceUID:   f.UID,
				NamespaceTitle: f.Title,
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

		t.Run("should return Forbidden if user cannot query a data source", func(t *testing.T) {
			g := models.RuleGen
			data1 := g.GenerateQuery()
			data2 := g.GenerateQuery()

			srv := &TestingApiSrv{
				authz: accesscontrol.NewRuleService(acMock.New().WithPermissions([]ac.Permission{
					{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(data1.DatasourceUID)},
				})),
				tracer: tracing.InitializeTracerForTest(),
			}

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
				Now:  time.Time{},
			})

			require.Equal(t, http.StatusForbidden, response.Status())
		})

		t.Run("should return 200 if user can query all data sources", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()
			data2 := models.GenerateAlertQuery()

			currentTime := time.Now()

			ac := acMock.New().WithPermissions([]ac.Permission{
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

			ruleStore := fakes2.NewRuleStore(t)

			srv := createTestingApiSrv(t, ds, ac, eval_mocks.NewEvaluatorFactory(evaluator), featuremgmt.WithFeatures(), ruleStore)

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
				Now:  currentTime,
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "EvaluateRaw", mock.Anything, currentTime)
		})
	})

	t.Run("when query is optimizable", func(t *testing.T) {
		rc := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}
		t.Run("should return warning notice on optimized queries", func(t *testing.T) {
			queries := []models.AlertQuery{
				models.CreatePrometheusQuery("A", "1", 1000, 43200, false, "some-ds"),
				models.CreatePrometheusQuery("B", "1", 1000, 43200, false, "some-ds"),
				models.CreatePrometheusQuery("C", "1", 1000, 43200, false, "some-ds"), // Not optimizable.
				models.CreateReduceExpression("D", "A", "last"),
				models.CreateReduceExpression("E", "B", "last"),
			}

			currentTime := time.Now()

			ac := acMock.New().WithPermissions([]ac.Permission{
				{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(queries[0].DatasourceUID)},
			})

			ds := &fakes.FakeCacheService{DataSources: []*datasources.DataSource{
				{UID: queries[0].DatasourceUID},
			}}

			evaluator := &eval_mocks.ConditionEvaluatorMock{}
			createEmptyFrameResponse := func(refId string) backend.DataResponse {
				frame := data.NewFrame("")
				frame.RefID = refId
				frame.SetMeta(&data.FrameMeta{})
				return backend.DataResponse{
					Frames: []*data.Frame{frame},
					Error:  nil,
				}
			}
			result := &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"A": createEmptyFrameResponse("A"),
					"B": createEmptyFrameResponse("B"),
					"C": createEmptyFrameResponse("C"),
				},
			}
			evaluator.EXPECT().EvaluateRaw(mock.Anything, mock.Anything).Return(result, nil)

			ruleStore := fakes2.NewRuleStore(t)

			srv := createTestingApiSrv(t, ds, ac, eval_mocks.NewEvaluatorFactory(evaluator), featuremgmt.WithManager(featuremgmt.FlagAlertingQueryOptimization), ruleStore)

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries(queries),
				Now:  currentTime,
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "EvaluateRaw", mock.Anything, currentTime)

			require.Equal(t, []data.Notice{{
				Severity: data.NoticeSeverityWarning,
				Text:     "Query optimized from Range to Instant type; all uses exclusively require the last datapoint. Consider modifying your query to Instant type to ensure accuracy.",
			}}, result.Responses["A"].Frames[0].Meta.Notices)

			require.Equal(t, []data.Notice{{
				Severity: data.NoticeSeverityWarning,
				Text:     "Query optimized from Range to Instant type; all uses exclusively require the last datapoint. Consider modifying your query to Instant type to ensure accuracy.",
			}}, result.Responses["B"].Frames[0].Meta.Notices)

			require.Equal(t, 0, len(result.Responses["C"].Frames[0].Meta.Notices))
		})
	})
}

func createTestingApiSrv(t *testing.T, ds *fakes.FakeCacheService, ac *acMock.Mock, evaluator eval.EvaluatorFactory, featureManager featuremgmt.FeatureToggles, ruleStore RuleStore) *TestingApiSrv {
	if ac == nil {
		ac = acMock.New()
	}

	return &TestingApiSrv{
		DatasourceCache: ds,
		authz:           accesscontrol.NewRuleService(ac),
		evaluator:       evaluator,
		cfg:             config(t),
		tracer:          tracing.InitializeTracerForTest(),
		featureManager:  featureManager,
		folderService:   ruleStore,
	}
}
