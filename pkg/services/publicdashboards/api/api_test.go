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
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardStore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourcesService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardsStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	publicdashboardsService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var userAdmin = &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testAdminUser"}
var userAdminRBAC = &user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testAdminUserRBAC", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsPublicWrite: {dashboards.ScopeDashboardsAll}}}}
var userViewer = &user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleViewer, Login: "testViewerUser"}
var userViewerRBAC = &user.SignedInUser{UserID: 4, OrgID: 1, OrgRole: org.RoleViewer, Login: "testViewerUserRBAC", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll}}}}
var anonymousUser *user.SignedInUser

type JsonErrResponse struct {
	Error string `json:"error"`
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
			cfg := setting.NewCfg()
			cfg.RBACEnabled = false
			service := publicdashboards.NewFakePublicDashboardService(t)

			if test.ExpectedServiceCalled {
				service.On("FindAnnotations", mock.Anything, mock.Anything, mock.AnythingOfType("string")).
					Return(test.Annotations, test.ServiceError).Once()
			}

			testServer := setupTestServer(t, cfg, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards), service, nil, anonymousUser)

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

func TestAPIFeatureFlag(t *testing.T) {
	testCases := []struct {
		Name   string
		Method string
		Path   string
	}{
		{
			Name:   "API: Load Dashboard",
			Method: http.MethodGet,
			Path:   "/api/public/dashboards/acbc123",
		},
		{
			Name:   "API: Query Dashboard",
			Method: http.MethodGet,
			Path:   "/api/public/dashboards/abc123/panels/2/query",
		},
		{
			Name:   "API: List Dashboards",
			Method: http.MethodGet,
			Path:   "/api/dashboards/public",
		},
		{
			Name:   "API: Get Public Dashboard Config",
			Method: http.MethodPost,
			Path:   "/api/dashboards/uid/abc123/public-config",
		},
		{
			Name:   "API: Upate Public Dashboard",
			Method: http.MethodPost,
			Path:   "/api/dashboards/uid/abc123/public-config",
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = false
			service := publicdashboards.NewFakePublicDashboardService(t)
			features := featuremgmt.WithFeatures()
			testServer := setupTestServer(t, cfg, features, service, nil, userAdmin)
			response := callAPI(testServer, test.Method, test.Path, nil, t)
			assert.Equal(t, http.StatusNotFound, response.Code)
		})
	}
}

func TestAPIListPublicDashboard(t *testing.T) {
	successResp := []PublicDashboardListResponse{
		{
			Uid:          "1234asdfasdf",
			AccessToken:  "asdfasdf",
			DashboardUid: "abc1234",
			IsEnabled:    true,
		},
	}

	testCases := []struct {
		Name                 string
		User                 *user.SignedInUser
		Response             []PublicDashboardListResponse
		ResponseErr          error
		ExpectedHttpResponse int
	}{
		{
			Name:                 "Anonymous user cannot list dashboards",
			User:                 anonymousUser,
			Response:             successResp,
			ResponseErr:          nil,
			ExpectedHttpResponse: http.StatusUnauthorized,
		},
		{
			Name:                 "User viewer can see public dashboards",
			User:                 userViewer,
			Response:             successResp,
			ResponseErr:          nil,
			ExpectedHttpResponse: http.StatusOK,
		},
		{
			Name:                 "Handles Service error",
			User:                 userViewer,
			Response:             nil,
			ResponseErr:          errors.New("error, service broken"),
			ExpectedHttpResponse: http.StatusInternalServerError,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)
			service.On("FindAll", mock.Anything, mock.Anything, mock.Anything).
				Return(test.Response, test.ResponseErr).Maybe()

			cfg := setting.NewCfg()
			cfg.RBACEnabled = false
			features := featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards)
			testServer := setupTestServer(t, cfg, features, service, nil, test.User)

			response := callAPI(testServer, http.MethodGet, "/api/dashboards/public", nil, t)
			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if test.ExpectedHttpResponse == http.StatusOK {
				var jsonResp []PublicDashboardListResponse
				err := json.Unmarshal(response.Body.Bytes(), &jsonResp)
				require.NoError(t, err)
				assert.Equal(t, jsonResp[0].Uid, "1234asdfasdf")
			}

			if test.ResponseErr != nil {
				var errResp JsonErrResponse
				err := json.Unmarshal(response.Body.Bytes(), &errResp)
				require.NoError(t, err)
				assert.Equal(t, "error, service broken", errResp.Error)
				service.AssertNotCalled(t, "FindAll")
			}
		})
	}
}

func TestAPIDeletePublicDashboard(t *testing.T) {
	dashboardUid := "abc1234"
	publicDashboardUid := "1234asdfasdf"
	userEditorAllPublicDashboard := &user.SignedInUser{UserID: 4, OrgID: 1, OrgRole: org.RoleEditor, Login: "testEditorUser", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsPublicWrite: {dashboards.ScopeDashboardsAll}}}}
	userEditorAnotherPublicDashboard := &user.SignedInUser{UserID: 4, OrgID: 1, OrgRole: org.RoleEditor, Login: "testEditorUser", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsPublicWrite: {"another-uid"}}}}
	userEditorPublicDashboard := &user.SignedInUser{UserID: 4, OrgID: 1, OrgRole: org.RoleEditor, Login: "testEditorUser", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsPublicWrite: {fmt.Sprintf("dashboards:uid:%s", dashboardUid)}}}}

	testCases := []struct {
		Name                 string
		User                 *user.SignedInUser
		ResponseErr          error
		ExpectedHttpResponse int
		ShouldCallService    bool
	}{
		{
			Name:                 "User viewer cannot delete public dashboard",
			User:                 userViewer,
			ResponseErr:          nil,
			ExpectedHttpResponse: http.StatusForbidden,
			ShouldCallService:    false,
		},
		{
			Name:                 "User editor without specific dashboard access cannot delete public dashboard",
			User:                 userEditorAnotherPublicDashboard,
			ResponseErr:          nil,
			ExpectedHttpResponse: http.StatusForbidden,
			ShouldCallService:    false,
		},
		{
			Name:                 "User editor with all dashboard accesses can delete public dashboard",
			User:                 userEditorAllPublicDashboard,
			ResponseErr:          nil,
			ExpectedHttpResponse: http.StatusOK,
			ShouldCallService:    true,
		},
		{
			Name:                 "User editor with dashboard access can delete public dashboard",
			User:                 userEditorPublicDashboard,
			ResponseErr:          nil,
			ExpectedHttpResponse: http.StatusOK,
			ShouldCallService:    true,
		},
		{
			Name:                 "Internal server error returns an error",
			User:                 userEditorPublicDashboard,
			ResponseErr:          errors.New("server error"),
			ExpectedHttpResponse: http.StatusInternalServerError,
			ShouldCallService:    true,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)

			if test.ShouldCallService {
				service.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(test.ResponseErr)
			}

			cfg := setting.NewCfg()

			features := featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards)
			testServer := setupTestServer(t, cfg, features, service, nil, test.User)

			response := callAPI(testServer, http.MethodDelete, fmt.Sprintf("/api/dashboards/%s/public/%s", dashboardUid, publicDashboardUid), nil, t)
			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			if test.ExpectedHttpResponse == http.StatusOK {
				var jsonResp any
				err := json.Unmarshal(response.Body.Bytes(), &jsonResp)
				require.NoError(t, err)
				assert.Equal(t, jsonResp, nil)
			}

			if !test.ShouldCallService {
				service.AssertNotCalled(t, "Delete")
			}

			if test.ResponseErr != nil {
				var errResp JsonErrResponse
				err := json.Unmarshal(response.Body.Bytes(), &errResp)
				require.NoError(t, err)
				assert.Equal(t, test.ResponseErr.Error(), errResp.Error)
			}
		})
	}
}

func TestAPIGetPublicDashboard(t *testing.T) {
	DashboardUid := "dashboard-abcd1234"

	testCases := []struct {
		Name                 string
		AccessToken          string
		ExpectedHttpResponse int
		DashboardResult      *models.Dashboard
		Err                  error
		FixedErrorResponse   string
	}{
		{
			Name:                 "It gets a public dashboard",
			AccessToken:          validAccessToken,
			ExpectedHttpResponse: http.StatusOK,
			DashboardResult: &models.Dashboard{
				Data: simplejson.NewFromAny(map[string]interface{}{
					"Uid": DashboardUid,
				}),
			},
			Err:                nil,
			FixedErrorResponse: "",
		},
		{
			Name:                 "It should return 404 if no public dashboard",
			AccessToken:          validAccessToken,
			ExpectedHttpResponse: http.StatusNotFound,
			DashboardResult:      nil,
			Err:                  ErrPublicDashboardNotFound,
			FixedErrorResponse:   "",
		},
		{
			Name:                 "It should return 400 if it is an invalid access token",
			AccessToken:          "SomeInvalidAccessToken",
			ExpectedHttpResponse: http.StatusBadRequest,
			DashboardResult:      nil,
			Err:                  nil,
			FixedErrorResponse:   "{\"message\":\"Invalid Access Token\"}",
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)
			service.On("FindPublicDashboardAndDashboardByAccessToken", mock.Anything, mock.AnythingOfType("string")).
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
				require.JSONEq(t, "{\"message\":\"Invalid Access Token\"}", response.Body.String())
			} else {
				var errResp JsonErrResponse
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
				service.On("FindByDashboardUid", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).
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
				service.On("Save", mock.Anything, mock.Anything, mock.AnythingOfType("*models.SavePublicDashboardConfigDTO")).
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
		require.JSONEq(t, "{\"message\":\"Invalid Access Token\"}", resp.Body.String())
	})

	t.Run("Status code is 400 when the intervalMS is lesser than 0", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), validAccessToken).Return(&backend.QueryDataResponse{}, ErrPublicDashboardBadRequest)
		resp := callAPI(server, http.MethodPost, getValidQueryPath(validAccessToken), strings.NewReader(`{"intervalMs":-100,"maxDataPoints":1000}`), t)
		require.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("Status code is 400 when the maxDataPoints is lesser than 0", func(t *testing.T) {
		server, fakeDashboardService := setup(true)
		fakeDashboardService.On("GetQueryDataResponse", mock.Anything, true, mock.Anything, int64(2), validAccessToken).Return(&backend.QueryDataResponse{}, ErrPublicDashboardBadRequest)
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
	db := db.InitTestDB(t)

	cacheService := datasourcesService.ProvideCacheService(localcache.ProvideService(), db)
	qds := buildQueryDataService(t, cacheService, nil, db)
	dsStore := datasourcesService.CreateStore(db, log.New("publicdashboards.test"))
	_ = dsStore.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
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
	dashboardStoreService := dashboardStore.ProvideDashboardStore(db, db.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(db, db.Cfg))
	dashboard, err := dashboardStoreService.SaveDashboard(context.Background(), saveDashboardCmd)
	require.NoError(t, err)

	// Create public dashboard
	savePubDashboardCmd := &SavePublicDashboardConfigDTO{
		DashboardUid: dashboard.Uid,
		OrgId:        dashboard.OrgId,
		PublicDashboard: &PublicDashboard{
			IsEnabled: true,
		},
	}

	annotationsService := annotationstest.NewFakeAnnotationsRepo()

	// create public dashboard
	store := publicdashboardsStore.ProvideStore(db)
	cfg := setting.NewCfg()
	ac := acmock.New()
	cfg.RBACEnabled = false
	service := publicdashboardsService.ProvideService(cfg, store, qds, annotationsService, ac)
	pubdash, err := service.Save(context.Background(), &user.SignedInUser{}, savePubDashboardCmd)
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
