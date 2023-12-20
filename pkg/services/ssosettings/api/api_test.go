package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestSSOSettingsAPI_Delete(t *testing.T) {
	type TestCase struct {
		desc                string
		key                 string
		action              string
		scope               string
		expectedError       error
		expectedServiceCall bool
		expectedStatusCode  int
	}

	tests := []TestCase{
		{
			desc:                "successfully deletes SSO settings",
			key:                 "azuread",
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedError:       nil,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNoContent,
		},
		{
			desc:                "fails when action doesn't match",
			key:                 "azuread",
			action:              "settings:read",
			scope:               "settings:auth.azuread:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope doesn't match",
			key:                 "azuread",
			action:              "settings:write",
			scope:               "settings:auth.azuread:read",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope contains another provider",
			key:                 "azuread",
			action:              "settings:write",
			scope:               "settings:auth.github:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails with not found when key is empty",
			key:                 "",
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusNotFound,
		},
		{
			desc:                "fails with not found when key was not found",
			key:                 "azuread",
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedError:       ssosettings.ErrNotFound,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNotFound,
		},
		{
			desc:                "fails with internal server error when service returns an error",
			key:                 "azuread",
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedError:       errors.New("something went wrong"),
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service := ssosettingstests.NewMockService(t)
			if tt.expectedServiceCall {
				service.On("Delete", mock.Anything, tt.key).Return(tt.expectedError).Once()
			}
			server := setupTests(t, service)

			path := fmt.Sprintf("/api/v1/sso-settings/%s", tt.key)
			req := server.NewRequest(http.MethodDelete, path, nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				OrgRole:     org.RoleEditor,
				OrgID:       1,
				Permissions: getPermissionsForActionAndScope(tt.action, tt.scope),
			})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			require.Equal(t, tt.expectedStatusCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestSSOSettingsAPI_GetForProvider(t *testing.T) {
	// TODO-Colin: add the annotations/comments for the openapi/swagger specification + unit test + the http api spec
	type TestCase struct {
		desc                string
		key                 string
		action              string
		scope               string
		expectedResult      *models.SSOSettings
		expectedError       error
		expectedServiceCall bool
		expectedStatusCode  int
	}

	tests := []TestCase{
		{
			desc:   "successfully gets SSO settings",
			key:    "azuread",
			action: "settings:read",
			scope:  "settings:auth.azuread:*",
			expectedResult: &models.SSOSettings{
				ID:        "1",
				Provider:  "azuread",
				Settings:  make(map[string]interface{}),
				Created:   time.Now(),
				Updated:   time.Now(),
				IsDeleted: false,
				Source:    models.DB,
			},
			expectedError:       nil,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusOK,
		},
		{
			desc:                "fails when action doesn't match",
			key:                 "azuread",
			action:              "",
			scope:               "settings:auth.azuread:*",
			expectedResult:      nil,
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope doesn't match",
			key:                 "azuread",
			action:              "settings:write",
			scope:               "settings:auth.azuread:read",
			expectedResult:      nil,
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope contains another provider",
			key:                 "azuread",
			action:              "settings:read",
			scope:               "settings:auth.github:*",
			expectedResult:      nil,
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails with not found when key was not found",
			key:                 "nonexistant",
			action:              "settings:read",
			scope:               "settings:auth.nonexistant:*",
			expectedResult:      nil,
			expectedError:       ssosettings.ErrNotFound,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNotFound,
		},
		{
			desc:                "fails with internal server error when service returns an error",
			key:                 "azuread",
			action:              "settings:read",
			scope:               "settings:auth.azuread:*",
			expectedResult:      nil,
			expectedError:       errors.New("something went wrong"),
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service := ssosettingstests.NewMockService(t)
			if tt.expectedServiceCall {
				service.On("GetForProvider", mock.AnythingOfType("*context.valueCtx"), tt.key).Return(tt.expectedResult, tt.expectedError).Once()
			}
			server := setupTests(t, service)

			path := fmt.Sprintf("/api/v1/sso-settings/%s", tt.key)
			req := server.NewRequest(http.MethodGet, path, nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				OrgRole:     org.RoleEditor,
				OrgID:       1,
				Permissions: getPermissionsForActionAndScope(tt.action, tt.scope),
			})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			require.Equal(t, tt.expectedStatusCode, res.StatusCode)

			if tt.expectedError == nil {
				var data models.SSOSettings
				require.NoError(t, json.NewDecoder(res.Body).Decode(&data))
			}

			require.NoError(t, res.Body.Close())
		})
	}
}

func getPermissionsForActionAndScope(action, scope string) map[int64]map[string][]string {
	return map[int64]map[string][]string{
		1: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{{
			Action: action, Scope: scope,
		}}),
	}
}

func setupTests(t *testing.T, service ssosettings.Service) *webtest.Server {
	t.Helper()

	cfg := setting.NewCfg()
	logger := log.NewNopLogger()

	api := &Api{
		Log:                logger,
		RouteRegister:      routing.NewRouteRegister(),
		AccessControl:      acimpl.ProvideAccessControl(cfg),
		SSOSettingsService: service,
	}

	api.RegisterAPIEndpoints()

	return webtest.NewServer(t, api.RouteRegister)
}
