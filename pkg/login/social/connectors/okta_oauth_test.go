package connectors

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSocialOkta_UserInfo(t *testing.T) {
	var boolPointer *bool

	tests := []struct {
		name                    string
		userRawJSON             string
		oAuth2Extra             any
		skipOrgRoleSync         bool
		allowAssignGrafanaAdmin bool
		roleAttributePath       string
		roleAttributeStrict     bool
		orgMapping              []string
		orgAttributePath        string
		expectedEmail           string
		expectedOrgRoles        map[int64]org.RoleType
		expectedGrafanaAdmin    *bool
		expectedErr             error
	}{
		{
			name:              "should give role from JSON and email from id token",
			userRawJSON:       `{ "email": "okta-octopus@grafana.com", "role": "Admin" }`,
			roleAttributePath: "role",
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedEmail:        "okto.octopus@test.com",
			expectedOrgRoles:     map[int64]org.RoleType{1: org.RoleAdmin},
			expectedGrafanaAdmin: boolPointer,
		},
		{
			name:              "should give empty role and nil pointer for GrafanaAdmin when skip org role sync enable",
			userRawJSON:       `{ "email": "okta-octopus@grafana.com", "role": "Admin" }`,
			roleAttributePath: "role",
			skipOrgRoleSync:   true,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedEmail:        "okto.octopus@test.com",
			expectedOrgRoles:     nil,
			expectedGrafanaAdmin: boolPointer,
		},
		{
			name:                    "should give grafanaAdmin role for specific GrafanaAdmin in the role assignement",
			userRawJSON:             fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "role": "%s" }`, social.RoleGrafanaAdmin),
			roleAttributePath:       "role",
			allowAssignGrafanaAdmin: true,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedEmail:        "okto.octopus@test.com",
			expectedOrgRoles:     map[int64]org.RoleType{1: org.RoleAdmin},
			expectedGrafanaAdmin: trueBoolPtr(),
		},
		{
			name:        "should fallback to default org role when role attribute path is empty",
			userRawJSON: fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "groups": ["Group 1"], "role": "%s" }`, org.RoleEditor),
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedEmail:    "okto.octopus@test.com",
			expectedOrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
		},
		{
			name:                "should map role when only org mapping is set",
			userRawJSON:         fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "groups": ["Group 1"], "role": "%s" }`, org.RoleEditor),
			orgAttributePath:    "groups",
			orgMapping:          []string{"Group 1:Org4:Editor", "*:Org5:Viewer"},
			roleAttributeStrict: false,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedEmail:    "okto.octopus@test.com",
			expectedOrgRoles: map[int64]org.RoleType{4: org.RoleEditor, 5: org.RoleViewer},
		},
		{
			name:                "should map role when only org mapping is set and role attribute strict is enabled",
			userRawJSON:         fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "groups": ["Group 1"], "role": "%s" }`, org.RoleEditor),
			orgAttributePath:    "groups",
			orgMapping:          []string{"Group 1:Org4:Editor", "*:Org5:Viewer"},
			roleAttributeStrict: true,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedEmail:    "okto.octopus@test.com",
			expectedOrgRoles: map[int64]org.RoleType{4: org.RoleEditor, 5: org.RoleViewer},
		},
		{
			name:              "should return nil OrgRoles when SkipOrgRoleSync is enabled",
			userRawJSON:       fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "role": "%s" }`, org.RoleEditor),
			roleAttributePath: "role",
			skipOrgRoleSync:   true,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedOrgRoles: nil,
			expectedEmail:    "okto.octopus@test.com",
		},
		{
			name:                "should return error when neither role attribute path nor org mapping evaluates to a role and role attribute strict is enabled",
			userRawJSON:         fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "role": "%s" }`, org.RoleEditor),
			roleAttributePath:   "invalid_role_path",
			roleAttributeStrict: true,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedErr: errRoleAttributeStrictViolation,
		},
		{
			name:                "should return error when neither role attribute path nor org mapping is set and role attribute strict is enabled",
			userRawJSON:         fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "role": "%s" }`, org.RoleEditor),
			roleAttributeStrict: true,
			oAuth2Extra: map[string]any{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			expectedErr: errRoleAttributeStrictViolation,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.WriteHeader(http.StatusOK)
				// return JSON if matches user endpoint
				if strings.HasSuffix(request.URL.String(), "/user") {
					writer.Header().Set("Content-Type", "application/json")
					_, err := writer.Write([]byte(tt.userRawJSON))
					require.NoError(t, err)
				} else {
					writer.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()

			cfg := &setting.Cfg{
				AutoAssignOrgRole: "Viewer", // default role
			}

			provider := NewOktaProvider(
				&social.OAuthInfo{
					ApiUrl:                  server.URL + "/user",
					RoleAttributePath:       tt.roleAttributePath,
					RoleAttributeStrict:     tt.roleAttributeStrict,
					OrgMapping:              tt.orgMapping,
					OrgAttributePath:        tt.orgAttributePath,
					AllowAssignGrafanaAdmin: tt.allowAssignGrafanaAdmin,
					SkipOrgRoleSync:         tt.skipOrgRoleSync,
				},
				cfg,
				ProvideOrgRoleMapper(cfg,
					&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				ssosettingstests.NewFakeService(),
				featuremgmt.WithFeatures())

			// create a oauth2 token with a id_token
			staticToken := oauth2.Token{
				AccessToken:  "",
				TokenType:    "",
				RefreshToken: "",
				Expiry:       time.Now(),
			}

			token := staticToken.WithExtra(tt.oAuth2Extra)
			actual, err := provider.UserInfo(context.Background(), server.Client(), token)

			if tt.expectedErr != nil {
				require.Error(t, err)
				require.ErrorIs(t, err, tt.expectedErr)
				return
			}

			require.Equal(t, tt.expectedEmail, actual.Email)
			require.Equal(t, tt.expectedOrgRoles, actual.OrgRoles)
			require.Equal(t, tt.expectedGrafanaAdmin, actual.IsGrafanaAdmin)
		})
	}
}

func TestSocialOkta_Validate(t *testing.T) {
	testCases := []struct {
		name      string
		settings  ssoModels.SSOSettings
		requester identity.Requester
		wantErr   error
	}{
		{
			name: "SSOSettings is valid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":                  "client-id",
					"allow_assign_grafana_admin": "true",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
					"api_url":                    "https://example.com/api",
				},
			},
			requester: &user.SignedInUser{IsGrafanaAdmin: true},
		},
		{
			name: "fails if settings map contains an invalid field",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":     "client-id",
					"invalid_field": []int{1, 2, 3},
				},
			},
			wantErr: ssosettings.ErrInvalidSettings,
		},
		{
			name: "fails if client id is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if client id does not exist",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if both allow assign grafana admin and skip org role sync are enabled",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":                  "client-id",
					"allow_assign_grafana_admin": "true",
					"skip_org_role_sync":         "true",
				},
			},
			requester: &user.SignedInUser{IsGrafanaAdmin: true},
			wantErr:   ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if the user is not allowed to update allow assign grafana admin",
			requester: &user.SignedInUser{
				IsGrafanaAdmin: false,
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":                  "client-id",
					"allow_assign_grafana_admin": "true",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if auth url is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if token url is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"token_url": "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if auth url is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "invalid_url",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if token url is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"token_url": "/path",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if api url is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"token_url": "https://example.com/token",
					"api_url":   "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if api url is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"api_url":   "/api",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewOktaProvider(&social.OAuthInfo{}, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

			if tc.requester == nil {
				tc.requester = &user.SignedInUser{IsGrafanaAdmin: false}
			}
			err := s.Validate(context.Background(), tc.settings, ssoModels.SSOSettings{}, tc.requester)
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestSocialOkta_Reload(t *testing.T) {
	testCases := []struct {
		name           string
		info           *social.OAuthInfo
		settings       ssoModels.SSOSettings
		expectError    bool
		expectedInfo   *social.OAuthInfo
		expectedConfig *oauth2.Config
	}{
		{
			name: "SSO provider successfully updated",
			info: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":     "new-client-id",
					"client_secret": "new-client-secret",
					"auth_url":      "some-new-url",
				},
			},
			expectError: false,
			expectedInfo: &social.OAuthInfo{
				ClientId:     "new-client-id",
				ClientSecret: "new-client-secret",
				AuthUrl:      "some-new-url",
			},
			expectedConfig: &oauth2.Config{
				ClientID:     "new-client-id",
				ClientSecret: "new-client-secret",
				Endpoint: oauth2.Endpoint{
					AuthURL: "some-new-url",
				},
				RedirectURL: "/login/okta",
			},
		},
		{
			name: "fails if settings contain invalid values",
			info: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":     "new-client-id",
					"client_secret": "new-client-secret",
					"auth_url":      []string{"first", "second"},
				},
			},
			expectError: true,
			expectedInfo: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
			},
			expectedConfig: &oauth2.Config{
				ClientID:     "client-id",
				ClientSecret: "client-secret",
				RedirectURL:  "/login/okta",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewOktaProvider(tc.info, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

			err := s.Reload(context.Background(), tc.settings)
			if tc.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tc.expectedInfo, s.info)
			require.EqualValues(t, tc.expectedConfig, s.Config)
		})
	}
}
