package connectors

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

const testGHUserTeamsJSON = `[
  {
    "id": 1,
    "node_id": "MDQ6VGVhbTE=",
    "url": "https://api.github.com/teams/1",
    "html_url": "https://github.com/orgs/github/teams/justice-league",
    "name": "Justice League",
    "slug": "justice-league",
    "description": "A great team.",
    "privacy": "closed",
    "permission": "admin",
    "members_url": "https://api.github.com/teams/1/members{/member}",
    "repositories_url": "https://api.github.com/teams/1/repos",
    "members_count": 3,
    "repos_count": 10,
    "created_at": "2017-07-14T16:53:42Z",
    "updated_at": "2017-08-17T12:37:15Z",
    "organization": {
      "login": "github",
      "id": 1,
      "node_id": "MDEyOk9yZ2FuaXphdGlvbjE=",
      "url": "https://api.github.com/orgs/github",
      "repos_url": "https://api.github.com/orgs/github/repos",
      "events_url": "https://api.github.com/orgs/github/events",
      "hooks_url": "https://api.github.com/orgs/github/hooks",
      "issues_url": "https://api.github.com/orgs/github/issues",
      "members_url": "https://api.github.com/orgs/github/members{/member}",
      "public_members_url": "https://api.github.com/orgs/github/public_members{/member}",
      "avatar_url": "https://github.com/images/error/octocat_happy.gif",
      "description": "A great organization",
      "name": "github",
      "company": "GitHub",
      "blog": "https://github.com/blog",
      "location": "San Francisco",
      "email": "octocat@github.com",
      "is_verified": true,
      "has_organization_projects": true,
      "has_repository_projects": true,
      "public_repos": 2,
      "public_gists": 1,
      "followers": 20,
      "following": 0,
      "html_url": "https://github.com/octocat",
      "created_at": "2008-01-14T04:33:35Z",
      "updated_at": "2017-08-17T12:37:15Z",
      "type": "Organization"
    },
	"parent": {
		"name": "DC",
		"id": 99,
		"node_id": "bm9kZTIyCg==",
		"slug": "dc",
		"description": "",
		"privacy": "closed",
		"notification_setting": "notifications_enabled",
		"url": "https://api.github.com/organizations/github/team/2",
		"html_url": "https://github.com/orgs/github/teams/dc",
		"members_url": "https://api.github.com/orgs/github/members{/member}",
		"repositories_url": "https://api.github.com/teams/2/repos",
		"permission": "pull"
	  }
  }
]`

var (
	testGHUserJSON           = fmt.Sprintf(testGHUserJSONTemplate, "octocat@github.com")
	testGHUserEmptyEmailJSON = fmt.Sprintf(testGHUserJSONTemplate, "")
)

const testGHUserJSONTemplate = `{
  "login": "octocat",
  "id": 1,
  "node_id": "MDQ6VXNlcjE=",
  "avatar_url": "https://github.com/images/error/octocat_happy.gif",
  "gravatar_id": "",
  "url": "https://api.github.com/users/octocat",
  "html_url": "https://github.com/octocat",
  "followers_url": "https://api.github.com/users/octocat/followers",
  "following_url": "https://api.github.com/users/octocat/following{/other_user}",
  "gists_url": "https://api.github.com/users/octocat/gists{/gist_id}",
  "starred_url": "https://api.github.com/users/octocat/starred{/owner}{/repo}",
  "subscriptions_url": "https://api.github.com/users/octocat/subscriptions",
  "organizations_url": "https://api.github.com/users/octocat/orgs",
  "repos_url": "https://api.github.com/users/octocat/repos",
  "events_url": "https://api.github.com/users/octocat/events{/privacy}",
  "received_events_url": "https://api.github.com/users/octocat/received_events",
  "type": "User",
  "site_admin": false,
  "name": "monalisa octocat",
  "company": "GitHub",
  "blog": "https://github.com/blog",
  "location": "San Francisco",
  "email": "%s",
  "hireable": false,
  "bio": "There once was...",
  "twitter_username": "monatheoctocat",
  "public_repos": 2,
  "public_gists": 1,
  "followers": 20,
  "following": 0,
  "created_at": "2008-01-14T04:33:35Z",
  "updated_at": "2008-01-14T04:33:35Z",
  "private_gists": 81,
  "total_private_repos": 100,
  "owned_private_repos": 100,
  "disk_usage": 10000,
  "collaborators": 8,
  "two_factor_authentication": true,
  "plan": {
    "name": "Medium",
    "space": 400,
    "private_repos": 20,
    "collaborators": 0
  }
}`

const testGHUserEmailJSON = `[{
	"email": "octocat@github.com",
	"primary": true,
	"verified": true
}]`

const testGHOrgsJSON = `[{
	"login": "github"
}]`

func TestSocialGitHub_UserInfo(t *testing.T) {
	var boolPointer *bool
	tests := []struct {
		name                     string
		userRawJSON              string
		userTeamsRawJSON         string
		settingAutoAssignOrgRole string
		settingAllowGrafanaAdmin bool
		settingSkipOrgRoleSync   bool
		roleAttributePath        string
		roleAttributeStrict      bool
		orgMapping               []string
		want                     *social.BasicUserInfo
		wantErr                  bool
		oAuthExtraInfo           map[string]string
	}{
		{
			name:              "should return default role if no role attribute path is set",
			userRawJSON:       testGHUserJSON,
			userTeamsRawJSON:  testGHUserTeamsJSON,
			roleAttributePath: "",
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:                "should fail when role attribute path is empty and role attribute strict is enabled",
			userRawJSON:         testGHUserJSON,
			userTeamsRawJSON:    testGHUserTeamsJSON,
			roleAttributePath:   "",
			roleAttributeStrict: true,
			wantErr:             true,
		},
		{
			name:                     "admin mapping takes precedence over auto assign org role",
			roleAttributePath:        "[login==octocat] && 'Admin' || 'Viewer'",
			userRawJSON:              testGHUserJSON,
			settingAutoAssignOrgRole: "Editor",
			userTeamsRawJSON:         testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:              "should map role when role attribute path is set",
			roleAttributePath: "contains(groups[*], '@github/justice-league') && 'Editor' || 'Viewer'",
			userRawJSON:       testGHUserJSON,
			userTeamsRawJSON:  testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:                   "should return empty role when skip org role sync is true",
			roleAttributePath:      "contains(groups[*], '@github/justice-league') && 'Editor' || 'Viewer'",
			settingSkipOrgRoleSync: true,
			userRawJSON:            testGHUserJSON,
			userTeamsRawJSON:       testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: nil,
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:                     "Should return nil pointer if allowGrafanaAdmin and skipOrgRoleSync setting is set to true",
			roleAttributePath:        "contains(groups[*], '@github/justice-league') && 'Editor' || 'Viewer'",
			settingSkipOrgRoleSync:   true,
			settingAllowGrafanaAdmin: true,
			userRawJSON:              testGHUserJSON,
			userTeamsRawJSON:         testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:             "1",
				Name:           "monalisa octocat",
				Email:          "octocat@github.com",
				Login:          "octocat",
				OrgRoles:       nil,
				Groups:         []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
				IsGrafanaAdmin: boolPointer,
			},
		},
		{
			name:                     "should fallback to default org role when role attribute path is empty and auto assign org role is set",
			roleAttributePath:        "",
			userRawJSON:              testGHUserJSON,
			settingAutoAssignOrgRole: "Editor",
			userTeamsRawJSON:         testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			// see: https://github.com/grafana/grafana/issues/85916
			name:                     "should check parent team id for team membership",
			roleAttributePath:        "",
			userRawJSON:              testGHUserJSON,
			settingAutoAssignOrgRole: "Editor",
			userTeamsRawJSON:         testGHUserTeamsJSON,
			oAuthExtraInfo: map[string]string{
				"team_ids": "99",
			},
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:             "should map role when only org mapping is set",
			orgMapping:       []string{"@github/justice-league:Org4:Editor", "*:Org5:Viewer"},
			userRawJSON:      testGHUserJSON,
			userTeamsRawJSON: testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{4: "Editor", 5: "Viewer"},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:                "should map role when only org mapping is set and role attribute strict is enabled",
			orgMapping:          []string{"@github/justice-league:Org4:Editor", "*:Org5:Viewer"},
			roleAttributeStrict: true,
			userRawJSON:         testGHUserJSON,
			userTeamsRawJSON:    testGHUserTeamsJSON,
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{4: "Editor", 5: "Viewer"},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
		{
			name:                "should return error when neither role attribute path nor org mapping evaluates to a role and role attribute strict is enabled",
			orgMapping:          []string{"@github/avengers:Org4:Editor"},
			roleAttributeStrict: true,
			userRawJSON:         testGHUserJSON,
			userTeamsRawJSON:    testGHUserTeamsJSON,
			wantErr:             true,
		},
		{
			name:                "should return error when neither role attribute path nor org mapping is set and role attribute strict is enabled",
			roleAttributeStrict: true,
			userRawJSON:         testGHUserJSON,
			userTeamsRawJSON:    testGHUserTeamsJSON,
			wantErr:             true,
		},
		{
			name:             "should fetch email and allowed orgs",
			userRawJSON:      testGHUserEmptyEmailJSON,
			userTeamsRawJSON: testGHUserTeamsJSON,
			oAuthExtraInfo: map[string]string{
				"allowed_organizations": "github",
			},
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "monalisa octocat",
				Email:    "octocat@github.com",
				Login:    "octocat",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{"https://github.com/orgs/github/teams/justice-league", "@github/justice-league"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				reqURL := request.URL.String()

				// return JSON if matches user endpoint
				if strings.HasSuffix(reqURL, "/user") {
					writer.Header().Set("Content-Type", "application/json")
					_, err := writer.Write([]byte(tt.userRawJSON))
					require.NoError(t, err)
				} else if strings.HasSuffix(reqURL, "/user/teams?per_page=100") {
					writer.Header().Set("Content-Type", "application/json")
					_, err := writer.Write([]byte(tt.userTeamsRawJSON))
					require.NoError(t, err)
				} else if strings.HasSuffix(reqURL, "/emails") { // only called if email is empty
					writer.Header().Set("Content-Type", "application/json")
					_, err := writer.Write([]byte(testGHUserEmailJSON))
					require.NoError(t, err)
				} else if strings.HasSuffix(reqURL, "/orgs?per_page=100") {
					writer.Header().Set("Content-Type", "application/json")
					_, err := writer.Write([]byte(testGHOrgsJSON))
					require.NoError(t, err)
				} else {
					writer.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()

			cfg := &setting.Cfg{
				AutoAssignOrgRole: "Viewer", // default role
			}

			if tt.settingAutoAssignOrgRole != "" {
				cfg.AutoAssignOrgRole = tt.settingAutoAssignOrgRole
			}

			s := NewGitHubProvider(
				&social.OAuthInfo{
					ApiUrl:              server.URL + "/user",
					RoleAttributePath:   tt.roleAttributePath,
					RoleAttributeStrict: tt.roleAttributeStrict,
					OrgMapping:          tt.orgMapping,
					SkipOrgRoleSync:     tt.settingSkipOrgRoleSync,
					Extra:               tt.oAuthExtraInfo,
				}, cfg,
				ProvideOrgRoleMapper(cfg,
					&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				ssosettingstests.NewFakeService(),
				featuremgmt.WithFeatures())

			token := &oauth2.Token{
				AccessToken: "fake_token",
			}

			got, err := s.UserInfo(context.Background(), server.Client(), token)
			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.EqualValues(t, tt.want, got)
		})
	}
}

func TestSocialGitHub_InitializeExtraFields(t *testing.T) {
	type settingFields struct {
		teamIds              []int
		allowedOrganizations []string
	}
	testCases := []struct {
		name     string
		settings *social.OAuthInfo
		want     settingFields
	}{
		{
			name: "teamIds is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"team_ids": "1234,5678",
				},
			},
			want: settingFields{
				teamIds:              []int{1234, 5678},
				allowedOrganizations: []string{},
			},
		},
		{
			name: "allowedOrganizations is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"allowed_organizations": "uuid-1234,uuid-5678",
				},
			},
			want: settingFields{
				teamIds:              []int{},
				allowedOrganizations: []string{"uuid-1234", "uuid-5678"},
			},
		},
		{
			name: "teamIds and allowedOrganizations are empty",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"team_ids":              "",
					"allowed_organizations": "",
				},
			},
			want: settingFields{
				teamIds:              []int{},
				allowedOrganizations: []string{},
			},
		},
		{
			name: "should not error when teamIds are not integers",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"team_ids": "abc1234,5678",
				},
			},
			want: settingFields{
				teamIds:              []int{},
				allowedOrganizations: []string{},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGitHubProvider(tc.settings, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

			require.Equal(t, tc.want.teamIds, s.teamIds)
			require.Equal(t, tc.want.allowedOrganizations, s.allowedOrganizations)
		})
	}
}

func TestSocialGitHub_Validate(t *testing.T) {
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
			name: "fails if team ids are not integers",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"team_ids":  "abc1234,5678,def",
				},
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
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if token url is not empty",
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
			name: "fails if auth url is not empty",
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
			name: "fails if api url is not empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "",
					"token_url": "",
					"api_url":   "http://example.com/api",
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
			s := NewGitHubProvider(&social.OAuthInfo{}, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

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

func TestSocialGitHub_Reload(t *testing.T) {
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
				RedirectURL: "/login/github",
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
				RedirectURL:  "/login/github",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGitHubProvider(tc.info, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

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

func TestGitHub_Reload_ExtraFields(t *testing.T) {
	testCases := []struct {
		name                         string
		settings                     ssoModels.SSOSettings
		info                         *social.OAuthInfo
		expectError                  bool
		expectedInfo                 *social.OAuthInfo
		expectedAllowedOrganizations []string
		expectedTeamIds              []int
	}{
		{
			name: "successfully reloads the settings",
			info: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
				Extra: map[string]string{
					"allowed_organizations": "previous",
					"team_ids":              "",
				},
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"allowed_organizations": "uuid-1234,uuid-5678",
					"team_ids":              "123,456",
				},
			},
			expectedInfo: &social.OAuthInfo{
				ClientId:     "new-client-id",
				ClientSecret: "new-client-secret",
				Name:         "a-new-name",
				AuthStyle:    "inheader",
				Extra: map[string]string{
					"allowed_organizations": "uuid-1234,uuid-5678",
					"force_use_graph_api":   "false",
				},
			},
			expectedAllowedOrganizations: []string{"uuid-1234", "uuid-5678"},
			expectedTeamIds:              []int{123, 456},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGitHubProvider(tc.info, setting.NewCfg(), nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures())

			err := s.Reload(context.Background(), tc.settings)
			require.NoError(t, err)

			require.EqualValues(t, tc.expectedAllowedOrganizations, s.allowedOrganizations)
			require.EqualValues(t, tc.expectedTeamIds, s.teamIds)
		})
	}
}
