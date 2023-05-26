package api

import (
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

			srv := createTestingApiSrv(nil, ac, nil)

			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
					Now:       time.Time{},
				},
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

			var result []eval.Result
			evaluator := &eval_mocks.ConditionEvaluatorMock{}
			evaluator.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(result, nil)

			evalFactory := eval_mocks.NewEvaluatorFactory(evaluator)

			srv := createTestingApiSrv(ds, ac, evalFactory)

			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
					Now:       currentTime,
				},
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "Evaluate", mock.Anything, currentTime)
		})
	})

	t.Run("when fine-grained access is disabled", func(t *testing.T) {
		rc := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			IsSignedIn: false,
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}
		ac := acMock.New().WithDisabled()

		t.Run("should require user to be signed in", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()

			ds := &fakes.FakeCacheService{DataSources: []*datasources.DataSource{
				{UID: data1.DatasourceUID},
			}}
			currentTime := time.Now()

			evaluator := &eval_mocks.ConditionEvaluatorMock{}
			var result []eval.Result
			evaluator.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(result, nil)

			srv := createTestingApiSrv(ds, ac, eval_mocks.NewEvaluatorFactory(evaluator))

			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1}),
					Now:       currentTime,
				},
			})

			require.Equal(t, http.StatusUnauthorized, response.Status())
			evaluator.AssertNotCalled(t, "Evaluate", mock.Anything, currentTime)

			rc.IsSignedIn = true

			response = srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1}),
					Now:       currentTime,
				},
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "Evaluate", mock.Anything, currentTime)
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

			srv := createTestingApiSrv(ds, ac, eval_mocks.NewEvaluatorFactory(evaluator))

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1, data2}),
				Now:  currentTime,
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "EvaluateRaw", mock.Anything, currentTime)
		})
	})

	t.Run("when fine-grained access is disabled", func(t *testing.T) {
		rc := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			IsSignedIn: false,
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}
		ac := acMock.New().WithDisabled()

		t.Run("should require user to be signed in", func(t *testing.T) {
			data1 := models.GenerateAlertQuery()

			ds := &fakes.FakeCacheService{DataSources: []*datasources.DataSource{
				{UID: data1.DatasourceUID},
			}}

			currentTime := time.Now()

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

			srv := createTestingApiSrv(ds, ac, eval_mocks.NewEvaluatorFactory(evaluator))

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1}),
				Now:  currentTime,
			})

			require.Equal(t, http.StatusUnauthorized, response.Status())
			evaluator.AssertNotCalled(t, "EvaluateRaw", mock.Anything, mock.Anything)

			rc.IsSignedIn = true

			response = srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: ApiAlertQueriesFromAlertQueries([]models.AlertQuery{data1}),
				Now:  currentTime,
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "EvaluateRaw", mock.Anything, currentTime)
		})
	})
}

func createTestingApiSrv(ds *fakes.FakeCacheService, ac *acMock.Mock, evaluator eval.EvaluatorFactory) *TestingApiSrv {
	if ac == nil {
		ac = acMock.New().WithDisabled()
	}

	return &TestingApiSrv{
		DatasourceCache: ds,
		accessControl:   ac,
		evaluator:       evaluator,
	}
}
