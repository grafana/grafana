package connectors

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
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

func TestSocialGoogle_retrieveGroups(t *testing.T) {
	type fields struct {
		Scopes []string
	}
	type args struct {
		client   *http.Client
		userData *googleUserData
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    []string
		wantErr bool
	}{
		{
			name: "No scope",
			fields: fields{
				Scopes: []string{},
			},
			args: args{
				client: &http.Client{},
				userData: &googleUserData{
					Email: "test@example.com",
				},
			},
			want:    nil,
			wantErr: false,
		},
		{
			name: "No groups",
			fields: fields{
				Scopes: []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
			},
			args: args{
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`{
                                "memberships": [
                                ],
                                "nextPageToken": ""
                            }`)
							return resp.Result(), nil
						},
					},
				},
				userData: &googleUserData{
					Email: "test@example.com",
				},
			},
			want:    []string{},
			wantErr: false,
		},
		{
			name: "error retrieving groups",
			fields: fields{
				Scopes: []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
			},
			args: args{
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							return nil, errors.New("error retrieving groups")
						},
					},
				},
				userData: &googleUserData{
					Email: "test@example.com",
				},
			},
			want:    nil,
			wantErr: true,
		},

		{
			name: "Has 2 pages to fetch",
			fields: fields{
				Scopes: []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
			},
			args: args{
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							// First page
							if req.URL.Query().Get("pageToken") == "" {
								_, _ = resp.WriteString(`{
                        "memberships": [
                            {
                                "group": "test-group",
                                "groupKey": {
                                    "id": "test-group@google.com"
                                },
                                "displayName": "Test Group"
                            }
                        ],
                        "nextPageToken": "page-2"
                    }`)
							} else {
								// Second page
								_, _ = resp.WriteString(`{
                        "memberships": [
                            {
                                "group": "test-group-2",
                                "groupKey": {
                                    "id": "test-group-2@google.com"
                                },
                                "displayName": "Test Group 2"
                            }
                        ],
                        "nextPageToken": ""
                    }`)
							}
							return resp.Result(), nil
						},
					},
				},
				userData: &googleUserData{
					Email: "test@example.com",
				},
			},
			want:    []string{"test-group@google.com", "test-group-2@google.com"},
			wantErr: false,
		},
		{
			name: "Has one page to fetch",
			fields: fields{
				Scopes: []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
			},
			args: args{
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`{
                                "memberships": [
                                    {
                                        "group": "test-group",
                                        "groupKey": {
                                            "id": "test-group@google.com"
                                        },
                                        "displayName": "Test Group"
                                    }
                                ],
                                "nextPageToken": ""
                            }`)
							return resp.Result(), nil
						},
					},
				},
				userData: &googleUserData{
					Email: "test@example.com",
				},
			},
			want:    []string{"test-group@google.com"},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewGoogleProvider(
				&social.OAuthInfo{
					ApiUrl:                  "",
					Scopes:                  tt.fields.Scopes,
					HostedDomain:            "",
					AllowedDomains:          []string{},
					AllowSignup:             false,
					RoleAttributePath:       "",
					RoleAttributeStrict:     false,
					AllowAssignGrafanaAdmin: false,
					SkipOrgRoleSync:         false,
				},
				&setting.Cfg{
					AutoAssignOrgRole: "",
				},
				nil,
				ssosettingstests.NewFakeService(),
				featuremgmt.WithFeatures())

			got, err := s.retrieveGroups(context.Background(), tt.args.client, tt.args.userData)
			if (err != nil) != tt.wantErr {
				t.Errorf("SocialGoogle.retrieveGroups() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.Equal(t, tt.want, got)
		})
	}
}

type roundTripperFunc struct {
	fn func(req *http.Request) (*http.Response, error)
}

func (f *roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f.fn(req)
}

const googleGroupsJSON = `
{
	"memberships": [
		{
			"group": "test-group",
			"groupKey": {
				"id": "test-group@google.com"
			},
			"displayName": "Test Group"
		}
	],
	"nextPageToken": ""
}
`

func TestSocialGoogle_UserInfo(t *testing.T) {
	cl := jwt.Claims{
		Subject:   "88888888888888",
		Issuer:    "issuer",
		NotBefore: jwt.NewNumericDate(time.Date(2016, 1, 1, 0, 0, 0, 0, time.UTC)),
		Audience:  jwt.Audience{"823123"},
	}

	sig, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: []byte("secret")}, (&jose.SignerOptions{}).WithType("JWT"))
	require.NoError(t, err)
	idMap := map[string]any{
		"email":          "test@example.com",
		"name":           "Test User",
		"hd":             "example.com",
		"email_verified": true,
	}

	raw, err := jwt.Signed(sig).Claims(cl).Claims(idMap).CompactSerialize()
	require.NoError(t, err)

	tokenWithID := (&oauth2.Token{
		AccessToken: "fake_token",
	}).WithExtra(map[string]any{"id_token": raw})

	tokenWithoutID := &oauth2.Token{}

	groupClient := &http.Client{
		Transport: &roundTripperFunc{
			fn: func(req *http.Request) (*http.Response, error) {
				resp := httptest.NewRecorder()
				_, _ = resp.WriteString(googleGroupsJSON)
				return resp.Result(), nil
			},
		},
	}

	type fields struct {
		Scopes                  []string
		apiURL                  string
		allowedGroups           []string
		roleAttributePath       string
		roleAttributeStrict     bool
		allowAssignGrafanaAdmin bool
		orgMapping              []string
		skipOrgRoleSync         bool
	}
	type args struct {
		client *http.Client
		token  *oauth2.Token
	}
	tests := []struct {
		name       string
		fields     fields
		args       args
		wantData   *social.BasicUserInfo
		wantErr    bool
		wantErrMsg string
	}{
		{
			name: "Success id_token",
			fields: fields{
				Scopes:          []string{},
				skipOrgRoleSync: true,
			},
			args: args{
				token: tokenWithID,
			},
			wantData: &social.BasicUserInfo{
				Id:    "88888888888888",
				Login: "test@example.com",
				Email: "test@example.com",
				Name:  "Test User",
			},
			wantErr: false,
		},
		{
			name: "Success id_token - groups requested",
			fields: fields{
				Scopes:          []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				skipOrgRoleSync: true,
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantData: &social.BasicUserInfo{
				Id:     "88888888888888",
				Login:  "test@example.com",
				Email:  "test@example.com",
				Name:   "Test User",
				Groups: []string{"test-group@google.com"},
			},
			wantErr: false,
		},
		{
			name: "Legacy API URL",
			fields: fields{
				apiURL:          legacyAPIURL,
				skipOrgRoleSync: true,
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`{
                                "id": "99999999999999",
                                "name": "Test User",
                                "email": "test@example.com",
                                "verified_email": true
                            }`)
							return resp.Result(), nil
						},
					},
				},
			},
			wantData: &social.BasicUserInfo{
				Id:    "99999999999999",
				Login: "test@example.com",
				Email: "test@example.com",
				Name:  "Test User",
			},
			wantErr: false,
		},
		{
			name: "Legacy API URL - no id provided",
			fields: fields{
				apiURL:          legacyAPIURL,
				skipOrgRoleSync: true,
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`{
                                "name": "Test User",
                                "email": "test@example.com",
                                "verified_email": true
                            }`)
							return resp.Result(), nil
						},
					},
				},
			},
			wantData:   nil,
			wantErr:    true,
			wantErrMsg: "error getting user info: id is empty",
		},
		{
			name: "Error unmarshalling legacy user info",
			fields: fields{
				apiURL: legacyAPIURL,
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`invalid json`)
							return resp.Result(), nil
						},
					},
				},
			},
			wantData:   nil,
			wantErr:    true,
			wantErrMsg: "error unmarshalling legacy user info",
		},
		{
			name: "Error getting user info",
			fields: fields{
				apiURL: "https://openidconnect.googleapis.com/v1/userinfo",
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							return nil, errors.New("error getting user info")
						},
					},
				},
			},
			wantData:   nil,
			wantErr:    true,
			wantErrMsg: "error getting user info",
		},
		{
			name: "Error unmarshalling user info",
			fields: fields{
				apiURL: "https://openidconnect.googleapis.com/v1/userinfo",
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`invalid json`)
							return resp.Result(), nil
						},
					},
				},
			},
			wantData:   nil,
			wantErr:    true,
			wantErrMsg: "error unmarshalling user info",
		},
		{
			name: "Success",
			fields: fields{
				apiURL:          "https://openidconnect.googleapis.com/v1/userinfo",
				skipOrgRoleSync: true,
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`{
                                "sub": "92222222222222222",
                                "name": "Test User",
                                "email": "test@example.com",
                                "email_verified": true
                            }`)
							return resp.Result(), nil
						},
					},
				},
			},
			wantData: &social.BasicUserInfo{
				Id:    "92222222222222222",
				Name:  "Test User",
				Email: "test@example.com",
				Login: "test@example.com",
			},
			wantErr: false,
		}, {
			name: "Unverified Email userinfo",
			fields: fields{
				apiURL: "https://openidconnect.googleapis.com/v1/userinfo",
			},
			args: args{
				token: tokenWithoutID,
				client: &http.Client{
					Transport: &roundTripperFunc{
						fn: func(req *http.Request) (*http.Response, error) {
							resp := httptest.NewRecorder()
							_, _ = resp.WriteString(`{
                                "sub": "92222222222222222",
                                "name": "Test User",
                                "email": "test@example.com",
                                "email_verified": false
                            }`)
							return resp.Result(), nil
						},
					},
				},
			},
			wantData:   nil,
			wantErr:    true,
			wantErrMsg: "email is not verified",
		},
		{
			name: "not in allowed Groups",
			fields: fields{
				Scopes:        []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				allowedGroups: []string{"not-that-one"},
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantData: &social.BasicUserInfo{
				Id:     "88888888888888",
				Login:  "test@example.com",
				Email:  "test@example.com",
				Name:   "Test User",
				Groups: []string{"test-group@google.com"},
			},
			wantErr:    true,
			wantErrMsg: "user not a member of one of the required groups",
		},
		{
			name: "Role mapping - strict",
			fields: fields{
				Scopes:              []string{},
				allowedGroups:       []string{},
				roleAttributePath:   "this",
				roleAttributeStrict: true,
			},
			args: args{
				token: tokenWithID,
			},
			wantData: &social.BasicUserInfo{
				Id:     "88888888888888",
				Login:  "test@example.com",
				Email:  "test@example.com",
				Name:   "Test User",
				Groups: []string{"test-group@google.com"},
			},
			wantErr:    true,
			wantErrMsg: "[oauth.role_attribute_strict_violation] could not evaluate any valid roles using IdP provided data",
		},
		{
			name: "role mapping from id_token - no allowed assign Grafana Admin",
			fields: fields{
				Scopes:                  []string{},
				allowAssignGrafanaAdmin: false,
				roleAttributePath:       "email_verified && 'GrafanaAdmin'",
			},
			args: args{
				token: tokenWithID,
			},
			wantData: &social.BasicUserInfo{
				Id:             "88888888888888",
				Login:          "test@example.com",
				Email:          "test@example.com",
				Name:           "Test User",
				OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
				IsGrafanaAdmin: nil,
			},
			wantErr: false,
		},
		{
			name: "role mapping from id_token - allowed assign Grafana Admin",
			fields: fields{
				Scopes:                  []string{},
				allowAssignGrafanaAdmin: true,
				roleAttributePath:       "email_verified && 'GrafanaAdmin'",
			},
			args: args{
				token: tokenWithID,
			},
			wantData: &social.BasicUserInfo{
				Id:             "88888888888888",
				Login:          "test@example.com",
				Email:          "test@example.com",
				Name:           "Test User",
				OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
				IsGrafanaAdmin: trueBoolPtr(),
			},
			wantErr: false,
		},
		{
			name: "mapping from groups",
			fields: fields{
				Scopes:            []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				roleAttributePath: "contains(groups[*], 'test-group@google.com') && 'Editor'",
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantData: &social.BasicUserInfo{
				Id:       "88888888888888",
				Login:    "test@example.com",
				Email:    "test@example.com",
				Name:     "Test User",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{"test-group@google.com"},
			},
			wantErr: false,
		},
		{
			name: "mapping from groups",
			fields: fields{
				Scopes:            []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				roleAttributePath: "contains(groups[*], 'test-group@google.com') && 'Editor'",
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantData: &social.BasicUserInfo{
				Id:       "88888888888888",
				Login:    "test@example.com",
				Email:    "test@example.com",
				Name:     "Test User",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{"test-group@google.com"},
			},
			wantErr: false,
		},
		{
			name: "Should map role when only org mapping is set",
			fields: fields{
				Scopes:     []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				orgMapping: []string{"test-group@google.com:Org4:Editor", "*:Org5:Viewer"},
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantData: &social.BasicUserInfo{
				Id:       "88888888888888",
				Login:    "test@example.com",
				Email:    "test@example.com",
				Name:     "Test User",
				OrgRoles: map[int64]org.RoleType{4: org.RoleEditor, 5: org.RoleViewer},
				Groups:   []string{"test-group@google.com"},
			},
			wantErr: false,
		},
		{
			name: "Should return error when neither role attribute path nor org mapping evaluates to a role and role attribute strict is enabled",
			fields: fields{
				Scopes:              []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				orgMapping:          []string{"other@google.com:Org4:Editor"},
				roleAttributeStrict: true,
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantErr: true,
		},
		{
			name: "Should return error when neither role attribute path nor org mapping is set and role attribute strict is enabled",
			fields: fields{
				Scopes:              []string{"https://www.googleapis.com/auth/cloud-identity.groups.readonly"},
				roleAttributeStrict: true,
			},
			args: args{
				token:  tokenWithID,
				client: groupClient,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()

			s := NewGoogleProvider(
				&social.OAuthInfo{
					ApiUrl:                  tt.fields.apiURL,
					Scopes:                  tt.fields.Scopes,
					AllowedGroups:           tt.fields.allowedGroups,
					RoleAttributePath:       tt.fields.roleAttributePath,
					RoleAttributeStrict:     tt.fields.roleAttributeStrict,
					AllowAssignGrafanaAdmin: tt.fields.allowAssignGrafanaAdmin,
					SkipOrgRoleSync:         tt.fields.skipOrgRoleSync,
					OrgMapping:              tt.fields.orgMapping,
				},
				cfg,
				ProvideOrgRoleMapper(cfg, &orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				ssosettingstests.NewFakeService(),
				featuremgmt.WithFeatures())

			gotData, err := s.UserInfo(context.Background(), tt.args.client, tt.args.token)
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErrMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.wantData, gotData)
			}
		})
	}
}

func TestSocialGoogle_Validate(t *testing.T) {
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
					"auth_url":                   "",
					"token_url":                  "",
					"api_url":                    "",
					"login_prompt":               "select_account",
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
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
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
			name: "fails if api url is not empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "",
					"token_url": "",
					"api_url":   "https://example.com/api",
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
			name: "fails if auth url is not empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"token_url": "",
					"api_url":   "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if api token url is not empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "",
					"token_url": "https://example.com/token",
					"api_url":   "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if login prompt is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":                  "client-id",
					"allow_assign_grafana_admin": "true",
					"login_prompt":               "invalid",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGoogleProvider(&social.OAuthInfo{}, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

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

func TestSocialGoogle_Reload(t *testing.T) {
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
					"login_prompt":  "login",
				},
			},
			expectError: false,
			expectedInfo: &social.OAuthInfo{
				ClientId:     "new-client-id",
				ClientSecret: "new-client-secret",
				AuthUrl:      "some-new-url",
				LoginPrompt:  "login",
			},
			expectedConfig: &oauth2.Config{
				ClientID:     "new-client-id",
				ClientSecret: "new-client-secret",
				Endpoint: oauth2.Endpoint{
					AuthURL: "some-new-url",
				},
				RedirectURL: "/login/google",
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
				RedirectURL:  "/login/google",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGoogleProvider(tc.info, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

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

func TestIsHDAllowed(t *testing.T) {
	testCases := []struct {
		name                 string
		email                string
		allowedDomains       []string
		expectedErrorMessage string
		validateHD           bool
	}{
		{
			name:                 "should not fail if no allowed domains are set",
			email:                "mycompany.com",
			allowedDomains:       []string{},
			expectedErrorMessage: "",
		},
		{
			name:                 "should not fail if email is from allowed domain",
			email:                "mycompany.com",
			allowedDomains:       []string{"grafana.com", "mycompany.com", "example.com"},
			expectedErrorMessage: "",
		},
		{
			name:                 "should fail if email is not from allowed domain",
			email:                "mycompany.com",
			allowedDomains:       []string{"grafana.com", "example.com"},
			expectedErrorMessage: "the hd claim found in the ID token is not present in the allowed domains",
		},
		{
			name:           "should not fail if the HD validation is disabled and the email not being from an allowed domain",
			email:          "mycompany.com",
			allowedDomains: []string{"grafana.com", "example.com"},
			validateHD:     true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			info := &social.OAuthInfo{}
			info.AllowedDomains = tc.allowedDomains
			s := NewGoogleProvider(info, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())
			s.validateHD = tc.validateHD
			err := s.isHDAllowed(tc.email)

			if tc.expectedErrorMessage != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tc.expectedErrorMessage)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
