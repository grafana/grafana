package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestRequiresValidAccessToken(t *testing.T) {
	t.Run("Returns 404 when access token is empty", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/api/public/ma/events/", nil)
		require.NoError(t, err)

		resp := runMiddleware(request, mockAccessTokenExistsResponse(false, nil))

		require.Equal(t, http.StatusNotFound, resp.Code)
	})

	t.Run("Returns 200 when public dashboard with access token exists", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/api/public/ma/events/myAccessToken", nil)
		require.NoError(t, err)

		resp := runMiddleware(request, mockAccessTokenExistsResponse(true, nil))

		require.Equal(t, http.StatusOK, resp.Code)
	})

	t.Run("Returns 400 when public dashboard with access token does not exist", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/api/public/ma/events/myAccessToken", nil)
		require.NoError(t, err)

		resp := runMiddleware(request, mockAccessTokenExistsResponse(false, nil))

		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Returns 500 when public dashboard service gives an error", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/api/public/ma/events/myAccessToken", nil)
		require.NoError(t, err)

		resp := runMiddleware(request, mockAccessTokenExistsResponse(false, fmt.Errorf("error not found")))

		require.Equal(t, http.StatusInternalServerError, resp.Code)
	})
}

func mockAccessTokenExistsResponse(returnArguments ...interface{}) *publicdashboardsService.PublicDashboardServiceImpl {
	fakeStore := &publicdashboards.FakePublicDashboardStore{}
	fakeStore.On("AccessTokenExists", mock.Anything, mock.Anything).Return(returnArguments[0], returnArguments[1])

	qds := query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Error: fmt.Errorf("query failed"),
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)

	return publicdashboardsService.ProvideService(setting.NewCfg(), fakeStore, qds)
}

func runMiddleware(request *http.Request, pubdashService *publicdashboardsService.PublicDashboardServiceImpl) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	m := web.New()
	initCtx := &models.ReqContext{}
	m.Use(func(c *web.Context) {
		initCtx.Context = c
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), initCtx))
	})
	m.Get("/api/public/ma/events/:accessToken", RequiresValidAccessToken(pubdashService), mockValidRequestHandler)
	m.ServeHTTP(recorder, request)

	return recorder
}

func mockValidRequestHandler(c *models.ReqContext) {
	resp := make(map[string]interface{})
	resp["message"] = "Valid request"
	c.JSON(http.StatusOK, resp)
}
