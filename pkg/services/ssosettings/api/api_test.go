package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestSSOSettingsAPI_Update(t *testing.T) {
	type TestCase struct {
		desc                string
		key                 string
		body                string
		action              string
		scope               string
		expectedError       error
		expectedServiceCall bool
		expectedStatusCode  int
	}

	tests := []TestCase{
		{
			desc:                "successfully updates SSO settings",
			key:                 social.GitHubProviderName,
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:write",
			scope:               "settings:auth.github:*",
			expectedError:       nil,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNoContent,
		},
		{
			desc:                "fails when action doesn't match",
			key:                 social.GitHubProviderName,
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:read",
			scope:               "settings:auth.github:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope doesn't match",
			key:                 social.GitHubProviderName,
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:write",
			scope:               "settings:auth.github:read",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope contains another provider",
			key:                 social.GitHubProviderName,
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:write",
			scope:               "settings:auth.okta:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails with not found when key is empty",
			key:                 "",
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:write",
			scope:               "settings:auth.github:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusNotFound,
		},
		{
			desc:                "fails with bad request when body contains invalid json",
			key:                 social.GitHubProviderName,
			body:                `{ invalid json }`,
			action:              "settings:write",
			scope:               "settings:auth.github:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusBadRequest,
		},
		{
			desc:                "fails with bad request when key was not found",
			key:                 social.GitHubProviderName,
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:write",
			scope:               "settings:auth.github:*",
			expectedError:       ssosettings.ErrInvalidProvider.Errorf("invalid provider"),
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusBadRequest,
		},
		{
			desc:                "fails with internal server error when service returns an error",
			key:                 social.GitHubProviderName,
			body:                `{"settings": {"enabled": true}}`,
			action:              "settings:write",
			scope:               "settings:auth.github:*",
			expectedError:       errors.New("something went wrong"),
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var input models.SSOSettings
			_ = json.Unmarshal([]byte(tt.body), &input)

			settings := models.SSOSettings{
				Provider: tt.key,
				Settings: input.Settings,
			}

			signedInUser := &user.SignedInUser{
				OrgRole:     org.RoleAdmin,
				OrgID:       1,
				Permissions: getPermissionsForActionAndScope(tt.action, tt.scope),
			}

			service := ssosettingstests.NewMockService(t)
			if tt.expectedServiceCall {
				service.On("Upsert", mock.Anything, &settings, signedInUser).Return(tt.expectedError).Once()
			}
			server := setupTests(t, service)

			path := fmt.Sprintf("/api/v1/sso-settings/%s", tt.key)
			req := server.NewRequest(http.MethodPut, path, bytes.NewBufferString(tt.body))
			webtest.RequestWithSignedInUser(req, signedInUser)
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			require.Equal(t, tt.expectedStatusCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

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
			key:                 social.AzureADProviderName,
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedError:       nil,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNoContent,
		},
		{
			desc:                "fails when action doesn't match",
			key:                 social.AzureADProviderName,
			action:              "settings:read",
			scope:               "settings:auth.azuread:*",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope doesn't match",
			key:                 social.AzureADProviderName,
			action:              "settings:write",
			scope:               "settings:auth.azuread:read",
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope contains another provider",
			key:                 social.AzureADProviderName,
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
			key:                 social.AzureADProviderName,
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedError:       ssosettings.ErrNotFound,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNotFound,
		},
		{
			desc:                "fails with internal server error when service returns an error",
			key:                 social.AzureADProviderName,
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
			action:              "settings:write",
			scope:               "settings:auth.azuread:*",
			expectedResult:      nil,
			expectedError:       nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails when scope doesn't match",
			key:                 "azuread",
			action:              "settings:read",
			scope:               "settings:auth.azuread:write",
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
		{
			desc:                "fails with not found error when the provider is not configurable",
			key:                 "grafana_com",
			action:              "settings:read",
			scope:               "settings:*",
			expectedResult:      nil,
			expectedError:       ssosettings.ErrNotConfigurable,
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service := ssosettingstests.NewMockService(t)
			if tt.expectedServiceCall {
				service.On("GetForProviderWithRedactedSecrets", mock.AnythingOfType("*context.valueCtx"), tt.key).Return(tt.expectedResult, tt.expectedError).Once()
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

func TestSSOSettingsAPI_List(t *testing.T) {
	type TestCase struct {
		desc                string
		action              string
		scope               string
		expectedResult      []*models.SSOSettings
		errFromService      error
		wantErr             bool
		expectedErrMessage  string
		expectedServiceCall bool
		expectedStatusCode  int
	}

	tests := []TestCase{
		{
			desc:   "successfully lists SSO settings",
			action: "settings:read",
			scope:  "settings:auth.azuread:*",
			expectedResult: []*models.SSOSettings{
				{
					ID:       "1",
					Provider: "azuread",
					Settings: make(map[string]interface{}),
					Source:   models.DB,
				},
			},
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusOK,
		},
		{
			desc:                "returns empty list when the user has the action but the scope doesn't match any of the providerss scope",
			action:              "settings:read",
			scope:               "settings:auth.saml:write",
			expectedResult:      []*models.SSOSettings{},
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusOK,
		},
		{
			desc:   "successfully lists SSO settings when scope contains wildcard",
			action: "settings:read",
			scope:  "settings:*",
			expectedResult: []*models.SSOSettings{
				{
					ID:       "1",
					Provider: "azuread",
					Settings: make(map[string]interface{}),
					Source:   models.DB,
				},
				{
					ID:       "2",
					Provider: "github",
					Settings: make(map[string]interface{}),
					Source:   models.DB,
				},
				{
					ID:       "3",
					Provider: "okta",
					Settings: make(map[string]interface{}),
					Source:   models.System,
				},
			},
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusOK,
		},
		{
			desc:                "fails when action doesn't match",
			action:              "madeupaction:read",
			scope:               "madeupscope:*",
			wantErr:             true,
			expectedErrMessage:  "You'll need additional permissions to perform this action. Permissions needed: settings:read",
			expectedResult:      nil,
			expectedServiceCall: false,
			expectedStatusCode:  http.StatusForbidden,
		},
		{
			desc:                "fails with internal server error when service returns an error",
			action:              "settings:read",
			scope:               "settings:auth.azuread:*",
			errFromService:      errors.New("something went wrong"),
			expectedResult:      nil,
			wantErr:             true,
			expectedErrMessage:  "Failed to list all providers settings",
			expectedServiceCall: true,
			expectedStatusCode:  http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service := ssosettingstests.NewMockService(t)

			serviceResult := []*models.SSOSettings{
				{
					ID:        "1",
					Provider:  "azuread",
					Settings:  make(map[string]interface{}),
					Created:   time.Now(),
					Updated:   time.Now(),
					IsDeleted: false,
					Source:    models.DB,
				},
				{
					ID:        "2",
					Provider:  "github",
					Settings:  make(map[string]interface{}),
					Created:   time.Now(),
					Updated:   time.Now(),
					IsDeleted: false,
					Source:    models.DB,
				},
				{
					ID:        "3",
					Provider:  "okta",
					Settings:  make(map[string]interface{}),
					Created:   time.Now(),
					Updated:   time.Now(),
					IsDeleted: false,
					Source:    models.System,
				},
			}
			if tt.expectedServiceCall {
				service.On("ListWithRedactedSecrets", mock.AnythingOfType("*context.valueCtx")).Return(serviceResult, tt.errFromService).Once()
			}
			server := setupTests(t, service)

			path := "/api/v1/sso-settings"
			req := server.NewRequest(http.MethodGet, path, nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				OrgRole:     org.RoleEditor,
				OrgID:       1,
				Permissions: getPermissionsForActionAndScope(tt.action, tt.scope),
			})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			require.Equal(t, tt.expectedStatusCode, res.StatusCode)

			bodyBytes, err := io.ReadAll(res.Body)
			if err != nil {
				t.Fatalf("Failed to read response body: %v", err)
			}

			if tt.wantErr {
				var accessErrorResponse struct {
					AccessErrorID string `json:"accessErrorId"`
					Message       string `json:"message"`
					Title         string `json:"title"`
				}
				err = json.Unmarshal(bodyBytes, &accessErrorResponse)
				if err != nil {
					t.Fatalf("Failed to unmarshal response body into accessErrorResponse: %v", err)
				}

				require.Equal(t, tt.expectedErrMessage, accessErrorResponse.Message)
				return
			}

			var actual []*models.SSOSettings
			err = json.Unmarshal(bodyBytes, &actual)
			require.NoError(t, err)

			require.ElementsMatch(t, tt.expectedResult, actual)
			err = res.Body.Close()
			require.NoError(t, err)
		})
	}
}

func getPermissionsForActionAndScope(action, scope string) map[int64]map[string][]string {
	return map[int64]map[string][]string{
		1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{{
			Action: action, Scope: scope,
		}}),
	}
}

func setupTests(t *testing.T, service ssosettings.Service) *webtest.Server {
	t.Helper()

	logger := log.NewNopLogger()
	api := &Api{
		Log:                logger,
		RouteRegister:      routing.NewRouteRegister(),
		AccessControl:      acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		SSOSettingsService: service,
	}

	api.RegisterAPIEndpoints()

	return webtest.NewServer(t, api.RouteRegister)
}
