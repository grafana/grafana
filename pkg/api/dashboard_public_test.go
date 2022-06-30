package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"

	"github.com/gofrs/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPIGetPublicDashboard(t *testing.T) {
	t.Run("It should 404 if featureflag is not enabled", func(t *testing.T) {
		sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures())
		dashSvc := dashboards.NewFakeDashboardService(t)
		dashSvc.On("GetPublicDashboard", mock.Anything, mock.AnythingOfType("string")).
			Return(&models.Dashboard{}, nil).Maybe()
		sc.hs.dashboardService = dashSvc

		setInitCtxSignedInViewer(sc.initCtx)
		response := callAPI(
			sc.server,
			http.MethodGet,
			"/api/public/dashboards",
			nil,
			t,
		)
		assert.Equal(t, http.StatusNotFound, response.Code)
		response = callAPI(
			sc.server,
			http.MethodGet,
			"/api/public/dashboards/asdf",
			nil,
			t,
		)
		assert.Equal(t, http.StatusNotFound, response.Code)
	})

	DashboardUid := "dashboard-abcd1234"
	token, err := uuid.NewV4()
	require.NoError(t, err)
	accessToken := fmt.Sprintf("%x", token)

	testCases := []struct {
		Name                  string
		AccessToken           string
		ExpectedHttpResponse  int
		publicDashboardResult *models.Dashboard
		publicDashboardErr    error
	}{
		{
			Name:                 "It gets a public dashboard",
			AccessToken:          accessToken,
			ExpectedHttpResponse: http.StatusOK,
			publicDashboardResult: &models.Dashboard{
				Data: simplejson.NewFromAny(map[string]interface{}{
					"Uid": DashboardUid,
				}),
			},
			publicDashboardErr: nil,
		},
		{
			Name:                  "It should return 404 if isPublicDashboard is false",
			AccessToken:           accessToken,
			ExpectedHttpResponse:  http.StatusNotFound,
			publicDashboardResult: nil,
			publicDashboardErr:    dashboards.ErrPublicDashboardNotFound,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))
			dashSvc := dashboards.NewFakeDashboardService(t)
			dashSvc.On("GetPublicDashboard", mock.Anything, mock.AnythingOfType("string")).
				Return(test.publicDashboardResult, test.publicDashboardErr)
			sc.hs.dashboardService = dashSvc

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodGet,
				fmt.Sprintf("/api/public/dashboards/%s", test.AccessToken),
				nil,
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if test.publicDashboardErr == nil {
				var dashResp dtos.DashboardFullWithMeta
				err := json.Unmarshal(response.Body.Bytes(), &dashResp)
				require.NoError(t, err)

				assert.Equal(t, DashboardUid, dashResp.Dashboard.Get("Uid").MustString())
				assert.Equal(t, false, dashResp.Meta.CanEdit)
				assert.Equal(t, false, dashResp.Meta.CanDelete)
				assert.Equal(t, false, dashResp.Meta.CanSave)
			} else {
				var errResp struct {
					Error string `json:"error"`
				}
				err := json.Unmarshal(response.Body.Bytes(), &errResp)
				require.NoError(t, err)
				assert.Equal(t, test.publicDashboardErr.Error(), errResp.Error)
			}
		})
	}
}

func TestAPIGetPublicDashboardConfig(t *testing.T) {
	pubdash := &models.PublicDashboard{IsEnabled: true}

	testCases := []struct {
		Name                  string
		DashboardUid          string
		ExpectedHttpResponse  int
		PublicDashboardResult *models.PublicDashboard
		PublicDashboardError  error
	}{
		{
			Name:                  "retrieves public dashboard config when dashboard is found",
			DashboardUid:          "1",
			ExpectedHttpResponse:  http.StatusOK,
			PublicDashboardResult: pubdash,
			PublicDashboardError:  nil,
		},
		{
			Name:                  "returns 404 when dashboard not found",
			DashboardUid:          "77777",
			ExpectedHttpResponse:  http.StatusNotFound,
			PublicDashboardResult: nil,
			PublicDashboardError:  dashboards.ErrDashboardNotFound,
		},
		{
			Name:                  "returns 500 when internal server error",
			DashboardUid:          "1",
			ExpectedHttpResponse:  http.StatusInternalServerError,
			PublicDashboardResult: nil,
			PublicDashboardError:  errors.New("database broken"),
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))
			dashSvc := dashboards.NewFakeDashboardService(t)
			dashSvc.On("GetPublicDashboardConfig", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).
				Return(test.PublicDashboardResult, test.PublicDashboardError)
			sc.hs.dashboardService = dashSvc

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodGet,
				"/api/dashboards/uid/1/public-config",
				nil,
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if response.Code == http.StatusOK {
				var pdcResp models.PublicDashboard
				err := json.Unmarshal(response.Body.Bytes(), &pdcResp)
				require.NoError(t, err)
				assert.Equal(t, test.PublicDashboardResult, &pdcResp)
			}
		})
	}
}

func TestApiSavePublicDashboardConfig(t *testing.T) {
	testCases := []struct {
		Name                  string
		DashboardUid          string
		publicDashboardConfig *models.PublicDashboard
		ExpectedHttpResponse  int
		saveDashboardError    error
	}{
		{
			Name:                  "returns 200 when update persists",
			DashboardUid:          "1",
			publicDashboardConfig: &models.PublicDashboard{IsEnabled: true},
			ExpectedHttpResponse:  http.StatusOK,
			saveDashboardError:    nil,
		},
		{
			Name:                  "returns 500 when not persisted",
			ExpectedHttpResponse:  http.StatusInternalServerError,
			publicDashboardConfig: &models.PublicDashboard{},
			saveDashboardError:    errors.New("backend failed to save"),
		},
		{
			Name:                  "returns 404 when dashboard not found",
			ExpectedHttpResponse:  http.StatusNotFound,
			publicDashboardConfig: &models.PublicDashboard{},
			saveDashboardError:    dashboards.ErrDashboardNotFound,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))

			dashSvc := dashboards.NewFakeDashboardService(t)
			dashSvc.On("SavePublicDashboardConfig", mock.Anything, mock.AnythingOfType("*dashboards.SavePublicDashboardConfigDTO")).
				Return(&models.PublicDashboard{IsEnabled: true}, test.saveDashboardError)
			sc.hs.dashboardService = dashSvc

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodPost,
				"/api/dashboards/uid/1/public-config",
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			// check the result if it's a 200
			if response.Code == http.StatusOK {
				val, err := json.Marshal(test.publicDashboardConfig)
				require.NoError(t, err)
				assert.Equal(t, string(val), response.Body.String())
			}
		})
	}
}

// `/public/dashboards/:uid/query`` endpoint test
func TestAPIQueryPublicDashboard(t *testing.T) {
	queryReturnsError := false

	qds := query.ProvideService(
		nil,
		&fakeDatasources.FakeCacheService{
			DataSources: []*datasources.DataSource{
				{Uid: "mysqlds"},
				{Uid: "promds"},
				{Uid: "promds2"},
			},
		},
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				if queryReturnsError {
					return nil, errors.New("error")
				}

				resp := backend.Responses{}

				for _, query := range req.Queries {
					resp[query.RefID] = backend.DataResponse{
						Frames: []*data.Frame{
							{
								RefID: query.RefID,
								Name:  "query-" + query.RefID,
							},
						},
					}
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)

	setup := func(enabled bool) (*webtest.Server, *dashboards.FakeDashboardService) {
		fakeDashboardService := &dashboards.FakeDashboardService{}

		return SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.queryDataService = qds
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards, enabled)
			hs.dashboardService = fakeDashboardService
		}), fakeDashboardService
	}

	t.Run("Status code is 404 when feature toggle is disabled", func(t *testing.T) {
		server, _ := setup(false)

		req := server.NewPostRequest(
			"/api/public/dashboards/abc123/panels/2/query",
			strings.NewReader("{}"),
		)
		resp, err := server.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Status code is 400 when the panel ID is invalid", func(t *testing.T) {
		server, _ := setup(true)

		req := server.NewPostRequest(
			"/api/public/dashboards/abc123/panels/notanumber/query",
			strings.NewReader("{}"),
		)
		resp, err := server.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Returns query data when feature toggle is enabled", func(t *testing.T) {
		server, fakeDashboardService := setup(true)

		fakeDashboardService.On("GetPublicDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{}, nil)
		fakeDashboardService.On("GetPublicDashboardConfig", mock.Anything, mock.Anything, mock.Anything).Return(&models.PublicDashboard{}, nil)

		fakeDashboardService.On(
			"BuildPublicDashboardMetricRequest",
			mock.Anything,
			mock.Anything,
			mock.Anything,
			int64(2),
		).Return(dtos.MetricRequest{
			Queries: []*simplejson.Json{
				simplejson.MustJson([]byte(`
					{
					  "datasource": {
						"type": "prometheus",
						"uid": "promds"
					  },
					  "exemplar": true,
					  "expr": "query_2_A",
					  "interval": "",
					  "legendFormat": "",
					  "refId": "A"
					}
				`)),
			},
		}, nil)
		req := server.NewPostRequest(
			"/api/public/dashboards/abc123/panels/2/query",
			strings.NewReader("{}"),
		)
		resp, err := server.SendJSON(req)
		require.NoError(t, err)
		bodyBytes, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(
			t,
			`{
				"results": {
					"A": {
						"frames": [
							{
								"data": {
									"values": []
								},
								"schema": {
									"fields": [],
									"refId": "A",
									"name": "query-A"
								}
							}
						]
					}
				}
			}`,
			string(bodyBytes),
		)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Status code is 500 when the query fails", func(t *testing.T) {
		server, fakeDashboardService := setup(true)

		fakeDashboardService.On("GetPublicDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{}, nil)
		fakeDashboardService.On("GetPublicDashboardConfig", mock.Anything, mock.Anything, mock.Anything).Return(&models.PublicDashboard{}, nil)
		fakeDashboardService.On(
			"BuildPublicDashboardMetricRequest",
			mock.Anything,
			mock.Anything,
			mock.Anything,
			int64(2),
		).Return(dtos.MetricRequest{
			Queries: []*simplejson.Json{
				simplejson.MustJson([]byte(`
					{
					  "datasource": {
						"type": "prometheus",
						"uid": "promds"
					  },
					  "exemplar": true,
					  "expr": "query_2_A",
					  "interval": "",
					  "legendFormat": "",
					  "refId": "A"
					}
				`)),
			},
		}, nil)
		req := server.NewPostRequest(
			"/api/public/dashboards/abc123/panels/2/query",
			strings.NewReader("{}"),
		)
		queryReturnsError = true
		resp, err := server.SendJSON(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
		queryReturnsError = false
	})

	t.Run("Status code is 200 when a panel has queries from multiple datasources", func(t *testing.T) {
		server, fakeDashboardService := setup(true)

		fakeDashboardService.On("GetPublicDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{}, nil)
		fakeDashboardService.On("GetPublicDashboardConfig", mock.Anything, mock.Anything, mock.Anything).Return(&models.PublicDashboard{}, nil)
		fakeDashboardService.On(
			"BuildPublicDashboardMetricRequest",
			mock.Anything,
			mock.Anything,
			mock.Anything,
			int64(2),
		).Return(dtos.MetricRequest{
			Queries: []*simplejson.Json{
				simplejson.MustJson([]byte(`
					{
					  "datasource": {
						"type": "prometheus",
						"uid": "promds"
					  },
					  "exemplar": true,
					  "expr": "query_2_A",
					  "interval": "",
					  "legendFormat": "",
					  "refId": "A"
					}
				`)),
				simplejson.MustJson([]byte(`
					{
					  "datasource": {
						"type": "prometheus",
						"uid": "promds2"
					  },
					  "exemplar": true,
					  "expr": "query_2_B",
					  "interval": "",
					  "legendFormat": "",
					  "refId": "B"
					}
				`)),
			},
		}, nil)
		req := server.NewPostRequest(
			"/api/public/dashboards/abc123/panels/2/query",
			strings.NewReader("{}"),
		)
		resp, err := server.SendJSON(req)
		require.NoError(t, err)
		bodyBytes, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(
			t,
			`{
				"results": {
					"A": {
						"frames": [
							{
								"data": {
									"values": []
								},
								"schema": {
									"fields": [],
									"refId": "A",
									"name": "query-A"
								}
							}
						]
					},
					"B": {
						"frames": [
							{
								"data": {
									"values": []
								},
								"schema": {
									"fields": [],
									"refId": "B",
									"name": "query-B"
								}
							}
						]
					}
				}
			}`,
			string(bodyBytes),
		)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestIntegrationUnauthenticatedUserCanGetPubdashPanelQueryData(t *testing.T) {
	config := setting.NewCfg()
	db := sqlstore.InitTestDB(t)
	scenario := setupHTTPServerWithCfgDb(t, false, false, config, db, db, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))
	scenario.initCtx.SkipCache = true
	cacheService := service.ProvideCacheService(localcache.ProvideService(), db)
	qds := query.ProvideService(
		nil,
		cacheService,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Frames: []*data.Frame{{}},
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)
	scenario.hs.queryDataService = qds

	_ = db.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		Uid:      "ds1",
		OrgId:    1,
		Name:     "laban",
		Type:     datasources.DS_MYSQL,
		Access:   datasources.DS_ACCESS_DIRECT,
		Url:      "http://test",
		Database: "site",
		ReadOnly: true,
	})

	// Create Dashboard
	saveDashboardCmd := models.SaveDashboardCommand{
		OrgId:    1,
		FolderId: 1,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "test",
			"panels": []map[string]interface{}{
				{
					"id": 1,
					"targets": []map[string]interface{}{
						{
							"datasource": map[string]string{
								"type": "mysql",
								"uid":  "ds1",
							},
							"refId": "A",
						},
					},
				},
			},
		}),
	}
	dashboard, _ := scenario.dashboardsStore.SaveDashboard(saveDashboardCmd)

	// Create public dashboard
	savePubDashboardCmd := &dashboards.SavePublicDashboardConfigDTO{
		DashboardUid: dashboard.Uid,
		OrgId:        dashboard.OrgId,
		PublicDashboard: &models.PublicDashboard{
			IsEnabled: true,
		},
	}

	pubdash, err := scenario.hs.dashboardService.SavePublicDashboardConfig(context.Background(), savePubDashboardCmd)
	require.NoError(t, err)

	response := callAPI(
		scenario.server,
		http.MethodPost,
		fmt.Sprintf("/api/public/dashboards/%s/panels/1/query", pubdash.AccessToken),
		strings.NewReader(`{}`),
		t,
	)

	require.Equal(t, http.StatusOK, response.Code)
	bodyBytes, err := ioutil.ReadAll(response.Body)
	require.NoError(t, err)
	require.JSONEq(
		t,
		`{
				"results": {
					"A": {
						"frames": [
							{
								"data": {
									"values": []
								},
								"schema": {
									"fields": []
								}
							}
						]
					}
				}
			}`,
		string(bodyBytes),
	)
}
