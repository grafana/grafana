package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var userAdmin = &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testAdminUser"}
var userAdminRBAC = &user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testAdminUserRBAC", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsPublicWrite: {dashboards.ScopeDashboardsAll}}}}
var userViewer = &user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleViewer, Login: "testViewerUser"}
var userViewerRBAC = &user.SignedInUser{UserID: 4, OrgID: 1, OrgRole: org.RoleViewer, Login: "testViewerUserRBAC", Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll}}}}
var anonymousUser *user.SignedInUser

type JsonErrResponse struct {
	Error string `json:"error"`
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
			Path:   "/api/dashboards/public-dashboards",
		},
		{
			Name:   "API: Get Public Dashboard",
			Method: http.MethodPost,
			Path:   "/api/dashboards/uid/abc123/public-dashboards",
		},
		{
			Name:   "API: Save Public Dashboard",
			Method: http.MethodPost,
			Path:   "/api/dashboards/uid/abc123/public-dashboards",
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

			response := callAPI(testServer, http.MethodGet, "/api/dashboards/public-dashboards", nil, t)
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

func TestAPIGetPublicDashboard(t *testing.T) {
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
			Name:                  "retrieves public dashboard when dashboard is found",
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
			Name:                  "retrieves public dashboard when dashboard is found RBAC on",
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
				"/api/dashboards/uid/1/public-dashboard",
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

func TestApiSavePublicDashboard(t *testing.T) {
	testCases := []struct {
		Name                 string
		DashboardUid         string
		publicDashboard      *PublicDashboard
		ExpectedHttpResponse int
		SaveDashboardErr     error
		User                 *user.SignedInUser
		AccessControlEnabled bool
		ShouldCallService    bool
	}{
		{
			Name:                 "returns 200 when update persists",
			DashboardUid:         "1",
			publicDashboard:      &PublicDashboard{IsEnabled: true},
			ExpectedHttpResponse: http.StatusOK,
			SaveDashboardErr:     nil,
			User:                 userAdmin,
			AccessControlEnabled: false,
			ShouldCallService:    true,
		},
		{
			Name:                 "returns 500 when not persisted",
			ExpectedHttpResponse: http.StatusInternalServerError,
			publicDashboard:      &PublicDashboard{},
			SaveDashboardErr:     errors.New("backend failed to save"),
			User:                 userAdmin,
			AccessControlEnabled: false,
			ShouldCallService:    true,
		},
		{
			Name:                 "returns 404 when dashboard not found",
			ExpectedHttpResponse: http.StatusNotFound,
			publicDashboard:      &PublicDashboard{},
			SaveDashboardErr:     dashboards.ErrDashboardNotFound,
			User:                 userAdmin,
			AccessControlEnabled: false,
			ShouldCallService:    true,
		},
		{
			Name:                 "returns 200 when update persists RBAC on",
			DashboardUid:         "1",
			publicDashboard:      &PublicDashboard{IsEnabled: true},
			ExpectedHttpResponse: http.StatusOK,
			SaveDashboardErr:     nil,
			User:                 userAdminRBAC,
			AccessControlEnabled: true,
			ShouldCallService:    true,
		},
		{
			Name:                 "returns 403 when no permissions",
			ExpectedHttpResponse: http.StatusForbidden,
			publicDashboard:      &PublicDashboard{IsEnabled: true},
			SaveDashboardErr:     nil,
			User:                 userViewer,
			AccessControlEnabled: false,
			ShouldCallService:    false,
		},
		{
			Name:                 "returns 403 when no permissions RBAC on",
			ExpectedHttpResponse: http.StatusForbidden,
			publicDashboard:      &PublicDashboard{IsEnabled: true},
			SaveDashboardErr:     nil,
			User:                 userAdmin,
			AccessControlEnabled: true,
			ShouldCallService:    false,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			service := publicdashboards.NewFakePublicDashboardService(t)

			// this is to avoid AssertExpectations fail at t.Cleanup when the middleware returns before calling the service
			if test.ShouldCallService {
				service.On("Save", mock.Anything, mock.Anything, mock.AnythingOfType("*models.SavePublicDashboardDTO")).
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
				"/api/dashboards/uid/1/public-dashboard",
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			//check the result if it's a 200
			if response.Code == http.StatusOK {
				val, err := json.Marshal(test.publicDashboard)
				require.NoError(t, err)
				assert.Equal(t, string(val), response.Body.String())
			}
		})
	}
}
