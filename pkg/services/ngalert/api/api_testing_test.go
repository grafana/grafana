package api

import (
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	models2 "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acMock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestRouteTestGrafanaRuleConfig(t *testing.T) {
	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		rc := &models2.ReqContext{
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
					Data:      []models.AlertQuery{data1, data2},
					Now:       time.Time{},
				},
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
				{Uid: data1.DatasourceUID},
				{Uid: data2.DatasourceUID},
			}}

			evaluator := &eval.FakeEvaluator{}
			var result []eval.Result
			evaluator.EXPECT().Validate(mock.Anything, mock.Anything, mock.Anything).Return(nil)
			evaluator.EXPECT().ConditionEval(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(result)

			srv := createTestingApiSrv(ds, ac, evaluator)

			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      []models.AlertQuery{data1, data2},
					Now:       time.Time{},
				},
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "ConditionEval", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			evaluator.AssertCalled(t, "Validate", mock.Anything, mock.Anything, mock.Anything)
		})
	})

	t.Run("when fine-grained access is disabled", func(t *testing.T) {
		rc := &models2.ReqContext{
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
				{Uid: data1.DatasourceUID},
			}}

			evaluator := &eval.FakeEvaluator{}
			var result []eval.Result
			evaluator.EXPECT().Validate(mock.Anything, mock.Anything, mock.Anything).Return(nil)
			evaluator.EXPECT().ConditionEval(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(result)

			srv := createTestingApiSrv(ds, ac, evaluator)

			response := srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      []models.AlertQuery{data1},
					Now:       time.Time{},
				},
			})

			require.Equal(t, http.StatusUnauthorized, response.Status())
			evaluator.AssertNotCalled(t, "ConditionEval", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			evaluator.AssertNotCalled(t, "Validate", mock.Anything, mock.Anything, mock.Anything)

			rc.IsSignedIn = true

			response = srv.RouteTestGrafanaRuleConfig(rc, definitions.TestRulePayload{
				Expr: "",
				GrafanaManagedCondition: &definitions.EvalAlertConditionCommand{
					Condition: data1.RefID,
					Data:      []models.AlertQuery{data1},
					Now:       time.Time{},
				},
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "ConditionEval", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			evaluator.AssertCalled(t, "Validate", mock.Anything, mock.Anything, mock.Anything)
		})
	})
}

func TestRouteEvalQueries(t *testing.T) {
	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		rc := &models2.ReqContext{
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
				Data: []models.AlertQuery{data1, data2},
				Now:  time.Time{},
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
				{Uid: data1.DatasourceUID},
				{Uid: data2.DatasourceUID},
			}}

			evaluator := &eval.FakeEvaluator{}
			result := &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"test": {
						Frames: nil,
						Error:  nil,
					},
				},
			}
			evaluator.EXPECT().QueriesAndExpressionsEval(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(result, nil)

			srv := createTestingApiSrv(ds, ac, evaluator)

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: []models.AlertQuery{data1, data2},
				Now:  time.Time{},
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "QueriesAndExpressionsEval", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	})

	t.Run("when fine-grained access is disabled", func(t *testing.T) {
		rc := &models2.ReqContext{
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
				{Uid: data1.DatasourceUID},
			}}

			evaluator := &eval.FakeEvaluator{}
			result := &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"test": {
						Frames: nil,
						Error:  nil,
					},
				},
			}
			evaluator.EXPECT().QueriesAndExpressionsEval(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(result, nil)

			srv := createTestingApiSrv(ds, ac, evaluator)

			response := srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: []models.AlertQuery{data1},
				Now:  time.Time{},
			})

			require.Equal(t, http.StatusUnauthorized, response.Status())
			evaluator.AssertNotCalled(t, "QueriesAndExpressionsEval", mock.Anything, mock.Anything, mock.Anything, mock.Anything)

			rc.IsSignedIn = true

			response = srv.RouteEvalQueries(rc, definitions.EvalQueriesPayload{
				Data: []models.AlertQuery{data1},
				Now:  time.Time{},
			})

			require.Equal(t, http.StatusOK, response.Status())

			evaluator.AssertCalled(t, "QueriesAndExpressionsEval", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	})
}

func createTestingApiSrv(ds *fakes.FakeCacheService, ac *acMock.Mock, evaluator *eval.FakeEvaluator) *TestingApiSrv {
	if ac == nil {
		ac = acMock.New().WithDisabled()
	}

	return &TestingApiSrv{
		DatasourceCache: ds,
		accessControl:   ac,
		evaluator:       evaluator,
	}
}
