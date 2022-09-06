package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardStore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourcesService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/org"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var userAdmin = &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testAdminUser"}
var userAdminRBAC = &user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testAdminUserRBAC", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardPublicWrite: {dashboards.ScopeDashboardsAll}}}}
var userViewer = &user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleViewer, Login: "testViewerUser"}
var userViewerRBAC = &user.SignedInUser{UserID: 4, OrgID: 1, OrgRole: org.RoleViewer, Login: "testViewerUserRBAC", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll}}}}
var anonymousUser *user.SignedInUser

func TestAPIGetPublicDashboard(t *testing.T) {
	t.Run("It should 404 if featureflag is not enabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false
		service := publicdashboards.NewFakePublicDashboardService(t)
		service.On("GetPublicDashboard", mock.Anything, mock.AnythingOfType("string")).
			Return(&PublicDashboard{}, &models.Dashboard{}, nil).Maybe()
		service.On("GetPublicDashboardConfig", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).
			Return(&PublicDashboard{}, nil).Maybe()

		testServer := setupTestServer(t, cfg, featuremgmt.WithFeatures(), service, nil, anonymousUser)

		response := callAPI(testServer, http.MethodGet, "/api/public/dashboards", nil, t)
		assert.Equal(t, http.StatusNotFound, response.Code)

		response = callAPI(testServer, http.MethodGet, "/api/public/dashboards/asdf", nil, t)
		assert.Equal(t, http.StatusNotFound, response.Code)

		// control set. make sure routes are mounted
		testServer = setupTestServer(t, cfg, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards), service, nil, userAdmin)
		response = callAPI(testServer, http.MethodGet, "/api/public/dashboards/asdf", nil, t)
		assert.NotEqual(t, http.StatusNotFound, response.Code)
	})

	DashboardUid := "dashboard-abcd1234"
	token, err := uuid.NewRandom()
	require.NoError(t, err)
	accessToken := fmt.Sprintf("%x", token)

	testCases := []struct {
		Name                 string
		AccessToken          string
		ExpectedHttpResponse int
		DashboardResult      *models.Dashboard
		Err                  error
	}{
		{
			Name:                 "It gets a public dashboard",
			AccessToken:          accessToken,
			ExpectedHttpResponse: http.StatusOK,
			DashboardResult: &models.Dashboard{
				Data: simplejson.NewFromAny(map[string]interface{}{
					"Uid": DashboardUid,
				}),
			},
			Err: nil,
		},
		{
			Name:                 "It should return 404 if no public dashboard",
			AccessToken:          accessToken,
			ExpectedHttpResponse: http.StatusNotFound,
			DashboardResult:      nil,
			Err:                  ErrPublicDashboardNotFound,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)
			service.On("GetPublicDashboard", mock.Anything, mock.AnythingOfType("string")).
				Return(&PublicDashboard{}, test.DashboardResult, test.Err).Maybe()

			cfg := setting.NewCfg()
			cfg.RBACEnabled = false

			testServer := setupTestServer(
				t,
				cfg,
				featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards),
				service,
				nil,
				anonymousUser,
			)

			response := callAPI(testServer, http.MethodGet,
				fmt.Sprintf("/api/public/dashboards/%s", test.AccessToken),
				nil,
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if test.Err == nil {
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
				assert.Equal(t, test.Err.Error(), errResp.Error)
			}
		})
	}
}

func TestAPIGetPublicDashboardConfig(t *testing.T) {
	pubdash := &PublicDashboard{IsEnabled: true}

	testCases := []struct {
		Name                  string
		DashboardUid          string
		ExpectedHttpResponse  int
		PublicDashboardResult *PublicDashboard
		PublicDashboardErr    error
		User                  *user.SignedInUser
		AccessControlEnabled  bool
		ShouldCallService     bool
	}{
		{
			Name:                  "retrieves public dashboard config when dashboard is found",
			DashboardUid:          "1",
			ExpectedHttpResponse:  http.StatusOK,
			PublicDashboardResult: pubdash,
			PublicDashboardErr:    nil,
			User:                  userViewer,
			AccessControlEnabled:  false,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 404 when dashboard not found",
			DashboardUid:          "77777",
			ExpectedHttpResponse:  http.StatusNotFound,
			PublicDashboardResult: nil,
			PublicDashboardErr:    dashboards.ErrDashboardNotFound,
			User:                  userViewer,
			AccessControlEnabled:  false,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 500 when internal server error",
			DashboardUid:          "1",
			ExpectedHttpResponse:  http.StatusInternalServerError,
			PublicDashboardResult: nil,
			PublicDashboardErr:    errors.New("database broken"),
			User:                  userViewer,
			AccessControlEnabled:  false,
			ShouldCallService:     true,
		},
		{
			Name:                  "retrieves public dashboard config when dashboard is found RBAC on",
			DashboardUid:          "1",
			ExpectedHttpResponse:  http.StatusOK,
			PublicDashboardResult: pubdash,
			PublicDashboardErr:    nil,
			User:                  userViewerRBAC,
			AccessControlEnabled:  true,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 403 when no permissions RBAC on",
			ExpectedHttpResponse:  http.StatusForbidden,
			PublicDashboardResult: pubdash,
			PublicDashboardErr:    nil,
			User:                  userViewer,
			AccessControlEnabled:  true,
			ShouldCallService:     false,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)

			if test.ShouldCallService {
				service.On("GetPublicDashboardConfig", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).
					Return(test.PublicDashboardResult, test.PublicDashboardErr)
			}

			cfg := setting.NewCfg()
			cfg.RBACEnabled = test.AccessControlEnabled

			testServer := setupTestServer(
				t,
				cfg,
				featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards),
				service,
				nil,
				test.User,
			)

			response := callAPI(
				testServer,
				http.MethodGet,
				"/api/dashboards/uid/1/public-config",
				nil,
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if response.Code == http.StatusOK {
				var pdcResp PublicDashboard
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
		publicDashboardConfig *PublicDashboard
		ExpectedHttpResponse  int
		SaveDashboardErr      error
		User                  *user.SignedInUser
		AccessControlEnabled  bool
		ShouldCallService     bool
	}{
		{
			Name:                  "returns 200 when update persists",
			DashboardUid:          "1",
			publicDashboardConfig: &PublicDashboard{IsEnabled: true},
			ExpectedHttpResponse:  http.StatusOK,
			SaveDashboardErr:      nil,
			User:                  userAdmin,
			AccessControlEnabled:  false,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 500 when not persisted",
			ExpectedHttpResponse:  http.StatusInternalServerError,
			publicDashboardConfig: &PublicDashboard{},
			SaveDashboardErr:      errors.New("backend failed to save"),
			User:                  userAdmin,
			AccessControlEnabled:  false,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 404 when dashboard not found",
			ExpectedHttpResponse:  http.StatusNotFound,
			publicDashboardConfig: &PublicDashboard{},
			SaveDashboardErr:      dashboards.ErrDashboardNotFound,
			User:                  userAdmin,
			AccessControlEnabled:  false,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 200 when update persists RBAC on",
			DashboardUid:          "1",
			publicDashboardConfig: &PublicDashboard{IsEnabled: true},
			ExpectedHttpResponse:  http.StatusOK,
			SaveDashboardErr:      nil,
			User:                  userAdminRBAC,
			AccessControlEnabled:  true,
			ShouldCallService:     true,
		},
		{
			Name:                  "returns 403 when no permissions",
			ExpectedHttpResponse:  http.StatusForbidden,
			publicDashboardConfig: &PublicDashboard{IsEnabled: true},
			SaveDashboardErr:      nil,
			User:                  userViewer,
			AccessControlEnabled:  false,
			ShouldCallService:     false,
		},
		{
			Name:                  "returns 403 when no permissions RBAC on",
			ExpectedHttpResponse:  http.StatusForbidden,
			publicDashboardConfig: &PublicDashboard{IsEnabled: true},
			SaveDashboardErr:      nil,
			User:                  userAdmin,
			AccessControlEnabled:  true,
			ShouldCallService:     false,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)

			// this is to avoid AssertExpectations fail at t.Cleanup when the middleware returns before calling the service
			if test.ShouldCallService {
				service.On("SavePublicDashboardConfig", mock.Anything, mock.Anything, mock.AnythingOfType("*models.SavePublicDashboardConfigDTO")).
					Return(&PublicDashboard{IsEnabled: true}, test.SaveDashboardErr)
			}

			cfg := setting.NewCfg()
			cfg.RBACEnabled = test.AccessControlEnabled

			testServer := setupTestServer(
				t,
				cfg,
				featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards),
				service,
				nil,
				test.User,
			)

			response := callAPI(
				testServer,
				http.MethodPost,
				"/api/dashboards/uid/1/public-config",
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			//check the result if it's a 200
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
	mockedResponse := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{
			"test": {
				Frames: data.Frames{
					&data.Frame{
						Name: "anyDataFrame",
						Fields: []*data.Field{
							data.NewField("anyGroupName", nil, []*string{
								aws.String("group_a"), aws.String("group_b"), aws.String("group_c"),
							}),
						},
					},
				},
				Error: nil,
			},
		},
	}

	expectedResponse := `{
    "results": {
        "test": {
            "frames": [
                {
                    "schema": {
                        "name": "anyDataFrame",
                        "fields": [
                            {
                                "name": "anyGroupName",
                                "type": "string",
                                "typeInfo": {
                                    "frame": "string",
                                    "nullable": true
                                }
                            }
                        ]
                    },
                    "data": {
                        "values": [
                            [
                                "group_a",
                                "group_b",
                                "group_c"
                            ]
                        ]
                    }
                }
            ]
        }
    }
}`

	setup := func(enabled bool) (*web.Mux, *publicdashboards.FakePublicDashboardService) {
		service := publicdashboards.NewFakePublicDashboardService(t)
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false

		testServer := setupTestServer(
			t,
			cfg,
			featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards, enabled),
			service,
			nil,
			anonymousUser,
		)

		return testServer, service
	}

	t.Run("Status code is 404 when feature toggle is disabled", func(t *testing.T) {
		server, _ := setup(false)
		resp := callAPI(server, http.MethodPost, "/api/public/dashboards/abc123/panels/2/query", strings.NewReader("{}"), t)
		require.Equal(t, http.StatusNotFound, resp.Code)
	})

	t.Run("Status code is 400 when the panel ID is invalid", func(t *testing.T) {
		server, _ := setup(true)
		resp := callAPI(server, http.MethodPost, "/api/public/dashboards/abc123/panels/notanumber/query", strings.NewReader("{}"), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Status code is 400 when the intervalMS is lesser than 0", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), "abc123").Return(&backend.QueryDataResponse{}, ErrPublicDashboardBadRequest)
		resp := callAPI(server, http.MethodPost, "/api/public/dashboards/abc123/panels/2/query", strings.NewReader(`{"intervalMs":-100,"maxDataPoints":1000}`), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Status code is 400 when the maxDataPoints is lesser than 0", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), "abc123").Return(&backend.QueryDataResponse{}, ErrPublicDashboardBadRequest)
		resp := callAPI(server, http.MethodPost, "/api/public/dashboards/abc123/panels/2/query", strings.NewReader(`{"intervalMs":100,"maxDataPoints":-1000}`), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Returns query data when feature toggle is enabled", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), "abc123").Return(mockedResponse, nil)

		resp := callAPI(server, http.MethodPost, "/api/public/dashboards/abc123/panels/2/query", strings.NewReader("{}"), t)

		require.JSONEq(
			t,
			expectedResponse,
			resp.Body.String(),
		)
		require.Equal(t, http.StatusOK, resp.Code)
	})

	t.Run("Status code is 500 when the query fails", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), "abc123").Return(&backend.QueryDataResponse{}, fmt.Errorf("error"))

		resp := callAPI(server, http.MethodPost, "/api/public/dashboards/abc123/panels/2/query", strings.NewReader("{}"), t)
		require.Equal(t, http.StatusInternalServerError, resp.Code)
	})
}

func TestIntegrationUnauthenticatedUserCanGetPubdashPanelQueryData(t *testing.T) {
	db := sqlstore.InitTestDB(t)

	cacheService := datasourcesService.ProvideCacheService(localcache.ProvideService(), db)
	qds := buildQueryDataService(t, cacheService, nil, db)

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

	// create dashboard
	dashboardStoreService := dashboardStore.ProvideDashboardStore(db, featuremgmt.WithFeatures())
	dashboard, err := dashboardStoreService.SaveDashboard(saveDashboardCmd)
	require.NoError(t, err)

	// Create public dashboard
	savePubDashboardCmd := &SavePublicDashboardConfigDTO{
		DashboardUid: dashboard.Uid,
		OrgId:        dashboard.OrgId,
		PublicDashboard: &PublicDashboard{
			IsEnabled: true,
		},
	}

	// create public dashboard
	store := publicdashboardsStore.ProvideStore(db)
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	service := publicdashboardsService.ProvideService(cfg, store, qds)
	pubdash, err := service.SavePublicDashboardConfig(context.Background(), &user.SignedInUser{}, savePubDashboardCmd)
	require.NoError(t, err)

	// setup test server
	server := setupTestServer(t,
		cfg,
		featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards),
		service,
		db,
		anonymousUser,
	)

	resp := callAPI(server, http.MethodPost,
		fmt.Sprintf("/api/public/dashboards/%s/panels/1/query", pubdash.AccessToken),
		strings.NewReader(`{}`),
		t,
	)
	require.Equal(t, http.StatusOK, resp.Code)
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
		resp.Body.String(),
	)
}
