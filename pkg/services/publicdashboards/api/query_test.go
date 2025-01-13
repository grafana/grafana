package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardStore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	datasourcesService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestAPIViewPublicDashboard(t *testing.T) {
	DashboardUid := "dashboard-abcd1234"

	testCases := []struct {
		Name                 string
		AccessToken          string
		ExpectedHttpResponse int
		DashboardResult      *dtos.DashboardFullWithMeta
		Err                  error
		FixedErrorResponse   string
	}{
		{
			Name:                 "It gets a public dashboard",
			AccessToken:          validAccessToken,
			ExpectedHttpResponse: http.StatusOK,
			DashboardResult: &dtos.DashboardFullWithMeta{
				Dashboard: simplejson.NewFromAny(map[string]any{
					"Uid": DashboardUid,
				}),
				Meta: dtos.DashboardMeta{
					Type:                   dashboards.DashTypeDB,
					CanStar:                false,
					CanSave:                false,
					CanEdit:                false,
					CanAdmin:               false,
					CanDelete:              false,
					IsFolder:               false,
					PublicDashboardEnabled: true,
				},
			},
			Err:                nil,
			FixedErrorResponse: "",
		},
		{
			Name:                 "It should return 404 if no public dashboard",
			AccessToken:          validAccessToken,
			ExpectedHttpResponse: http.StatusNotFound,
			DashboardResult:      nil,
			Err:                  ErrPublicDashboardNotFound.Errorf(""),
			FixedErrorResponse:   "",
		},
		{
			Name:                 "It should return 400 if it is an invalid access token",
			AccessToken:          "SomeInvalidAccessToken",
			ExpectedHttpResponse: http.StatusBadRequest,
			DashboardResult:      nil,
			Err:                  nil,
			FixedErrorResponse:   "{\"message\":\"Invalid access token\", \"messageId\":\"publicdashboards.invalidAccessToken\", \"statusCode\":400, \"traceID\":\"\"}",
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)
			service.On("GetPublicDashboardForView", mock.Anything, mock.AnythingOfType("string")).
				Return(test.DashboardResult, test.Err).Maybe()

			testServer := setupTestServer(t, nil, service, anonymousUser)

			response := callAPI(testServer, http.MethodGet,
				fmt.Sprintf("/api/public/dashboards/%s", test.AccessToken),
				nil,
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if test.Err == nil && test.FixedErrorResponse == "" {
				var dashResp dtos.DashboardFullWithMeta
				err := json.Unmarshal(response.Body.Bytes(), &dashResp)
				require.NoError(t, err)

				assert.Equal(t, DashboardUid, dashResp.Dashboard.Get("Uid").MustString())
				assert.Equal(t, false, dashResp.Meta.CanEdit)
				assert.Equal(t, false, dashResp.Meta.CanDelete)
				assert.Equal(t, false, dashResp.Meta.CanSave)
			} else if test.FixedErrorResponse != "" {
				require.Equal(t, test.ExpectedHttpResponse, response.Code)
				require.JSONEq(t, "{\"message\":\"Invalid access token\", \"messageId\":\"publicdashboards.invalidAccessToken\", \"statusCode\":400, \"traceID\":\"\"}", response.Body.String())
			} else {
				var errResp errutil.PublicError
				err := json.Unmarshal(response.Body.Bytes(), &errResp)
				require.NoError(t, err)
				assert.Equal(t, "Dashboard not found", errResp.Message)
				assert.Equal(t, "publicdashboards.notFound", errResp.MessageID)
			}
		})
	}
}

// `/public/dashboards/:uid/query“ endpoint test
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
			"status": 200,
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
		testServer := setupTestServer(t, nil, service, anonymousUser)

		return testServer, service
	}

	t.Run("Status code is 400 when the panel ID is invalid", func(t *testing.T) {
		server, _ := setup(true)
		path := fmt.Sprintf("/api/public/dashboards/%s/panels/notanumber/query", validAccessToken)
		resp := callAPI(server, http.MethodPost, path, strings.NewReader("{}"), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Status code is 400 when the access token is invalid", func(t *testing.T) {
		server, _ := setup(true)
		resp := callAPI(server, http.MethodPost, getValidQueryPath("SomeInvalidAccessToken"), strings.NewReader("{}"), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
		require.JSONEq(t, "{\"message\":\"Invalid access token\", \"messageId\":\"publicdashboards.invalidAccessToken\", \"statusCode\":400, \"traceID\":\"\"}", resp.Body.String())
	})

	t.Run("Status code is 400 when the intervalMS is lesser than 0", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), validAccessToken).Return(&backend.QueryDataResponse{}, ErrBadRequest.Errorf(""))
		resp := callAPI(server, http.MethodPost, getValidQueryPath(validAccessToken), strings.NewReader(`{"intervalMs":-100,"maxDataPoints":1000}`), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Status code is 400 when the maxDataPoints is lesser than 0", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), validAccessToken).Return(&backend.QueryDataResponse{}, ErrBadRequest.Errorf(""))
		resp := callAPI(server, http.MethodPost, getValidQueryPath(validAccessToken), strings.NewReader(`{"intervalMs":100,"maxDataPoints":-1000}`), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Returns query data when feature toggle is enabled", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), validAccessToken).Return(mockedResponse, nil)

		resp := callAPI(server, http.MethodPost, getValidQueryPath(validAccessToken), strings.NewReader("{}"), t)

		require.JSONEq(
			t,
			expectedResponse,
			resp.Body.String(),
		)
		require.Equal(t, http.StatusOK, resp.Code)
	})

	t.Run("Status code is 500 when the query fails", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), validAccessToken).Return(&backend.QueryDataResponse{}, fmt.Errorf("error"))

		resp := callAPI(server, http.MethodPost, getValidQueryPath(validAccessToken), strings.NewReader("{}"), t)
		require.Equal(t, http.StatusInternalServerError, resp.Code)
	})
}

func getValidQueryPath(accessToken string) string {
	return fmt.Sprintf("/api/public/dashboards/%s/panels/2/query", accessToken)
}

func TestIntegrationUnauthenticatedUserCanGetPubdashPanelQueryData(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	db, cfg := db.InitTestDBWithCfg(t)

	cacheService := datasourcesService.ProvideCacheService(localcache.ProvideService(), db, guardian.ProvideGuardian())
	qds := buildQueryDataService(t, cacheService, nil, db)
	dsStore := datasourcesService.CreateStore(db, log.New("publicdashboards.test"))
	_, _ = dsStore.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		UID:      "ds1",
		OrgID:    1,
		Name:     "laban",
		Type:     datasources.DS_MYSQL,
		Access:   datasources.DS_ACCESS_DIRECT,
		URL:      "http://test",
		Database: "site",
		ReadOnly: true,
	})

	// Create Dashboard
	saveDashboardCmd := dashboards.SaveDashboardCommand{
		OrgID:     1,
		FolderUID: "1",
		IsFolder:  false,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":    nil,
			"title": "test",
			"panels": []map[string]any{
				{
					"id": 1,
					"targets": []map[string]any{
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
	dashboardStoreService, err := dashboardStore.ProvideDashboardStore(db, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(db))
	require.NoError(t, err)
	dashboard, err := dashboardStoreService.SaveDashboard(context.Background(), saveDashboardCmd)
	require.NoError(t, err)

	// Create public dashboard
	isEnabled := true
	savePubDashboardCmd := &SavePublicDashboardDTO{
		DashboardUid: dashboard.UID,
		OrgID:        dashboard.OrgID,
		PublicDashboard: &PublicDashboardDTO{
			IsEnabled: &isEnabled,
		},
	}

	annotationsService := annotationstest.NewFakeAnnotationsRepo()

	// create public dashboard
	store := publicdashboardsStore.ProvideStore(db, cfg, featuremgmt.WithFeatures())
	cfg.PublicDashboardsEnabled = true
	ac := acmock.New()
	ws := publicdashboardsService.ProvideServiceWrapper(store)
	folderStore := folderimpl.ProvideDashboardFolderStore(db)
	dashPermissionService := acmock.NewMockedPermissionsService()
	dashService, err := service.ProvideDashboardServiceImpl(
		cfg, dashboardStoreService, folderStore,
		featuremgmt.WithFeatures(), acmock.NewMockedPermissionsService(), dashPermissionService, ac,
		foldertest.NewFakeService(), folder.NewFakeStore(), nil, zanzana.NewNoopClient(), nil, nil, nil, quotatest.New(false, nil), nil,
	)
	require.NoError(t, err)

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", FeaturePublicDashboardsEmailSharing).Return(false)
	pds := publicdashboardsService.ProvideService(cfg, featuremgmt.WithFeatures(), store, qds, annotationsService, ac, ws, dashService, license)
	pubdash, err := pds.Create(context.Background(), &user.SignedInUser{}, savePubDashboardCmd)
	require.NoError(t, err)

	// setup test server
	server := setupTestServer(t, cfg, pds, anonymousUser)

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
			"status": 200,
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

func TestAPIGetAnnotations(t *testing.T) {
	testCases := []struct {
		Name                  string
		ExpectedHttpResponse  int
		Annotations           []AnnotationEvent
		ServiceError          error
		AccessToken           string
		From                  string
		To                    string
		ExpectedServiceCalled bool
	}{
		{
			Name:                  "will return success when there is no error and to and from are provided",
			ExpectedHttpResponse:  http.StatusOK,
			Annotations:           []AnnotationEvent{{Id: 1}},
			ServiceError:          nil,
			AccessToken:           validAccessToken,
			From:                  "123",
			To:                    "123",
			ExpectedServiceCalled: true,
		},
		{
			Name:                  "will return 500 when service returns an error",
			ExpectedHttpResponse:  http.StatusInternalServerError,
			Annotations:           nil,
			ServiceError:          errors.New("an error happened"),
			AccessToken:           validAccessToken,
			From:                  "123",
			To:                    "123",
			ExpectedServiceCalled: true,
		},
		{
			Name:                  "will return 400 when has an incorrect Access Token",
			ExpectedHttpResponse:  http.StatusBadRequest,
			Annotations:           nil,
			ServiceError:          errors.New("an error happened"),
			AccessToken:           "TooShortAccessToken",
			From:                  "123",
			To:                    "123",
			ExpectedServiceCalled: false,
		},
	}
	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)

			if test.ExpectedServiceCalled {
				service.On("FindAnnotations", mock.Anything, mock.Anything, mock.AnythingOfType("string")).
					Return(test.Annotations, test.ServiceError).Once()
			}

			testServer := setupTestServer(t, nil, service, anonymousUser)

			path := fmt.Sprintf("/api/public/dashboards/%s/annotations?from=%s&to=%s", test.AccessToken, test.From, test.To)
			response := callAPI(testServer, http.MethodGet, path, nil, t)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if test.ExpectedHttpResponse == http.StatusOK {
				var items []AnnotationEvent
				err := json.Unmarshal(response.Body.Bytes(), &items)
				assert.NoError(t, err)
				assert.Equal(t, items, test.Annotations)
			}
		})
	}
}
