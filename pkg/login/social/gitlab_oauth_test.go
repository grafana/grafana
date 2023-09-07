package social

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/org"
)

const (
	apiURI    = "/api/v4"
	userURI   = "/api/v4/user"
	groupsURI = "/api/v4/groups?min_access_level=10&page=1&per_page=50"

	gitlabAttrPath = `is_admin && 'GrafanaAdmin' || contains(groups[*], 'admins') && 'Admin' || contains(groups[*], 'editors') && 'Editor' || contains(groups[*], 'viewers') && 'Viewer'`

	rootUserRespBody   = `{"id":1,"username":"root","name":"Administrator","state":"active","email":"root@example.org", "confirmed_at":"2022-09-13T19:38:04.891Z","is_admin":true,"namespace_id":1}`
	editorUserRespBody = `{"id":3,"username":"gitlab-editor","name":"Gitlab Editor","state":"active","email":"gitlab-editor@example.org", "confirmed_at":"2022-09-13T19:38:04.891Z","is_admin":false,"namespace_id":1}`

	adminGroup  = `{"id":4,"web_url":"http://grafana-gitlab.local/groups/admins","name":"Admins","path":"admins","project_creation_level":"developer","full_name":"Admins","full_path":"admins","created_at":"2022-09-13T19:38:04.891Z"}`
	editorGroup = `{"id":5,"web_url":"http://grafana-gitlab.local/groups/editors","name":"Editors","path":"editors","project_creation_level":"developer","full_name":"Editors","full_path":"editors","created_at":"2022-09-13T19:38:15.074Z"}`
	viewerGroup = `{"id":6,"web_url":"http://grafana-gitlab.local/groups/viewers","name":"Viewers","path":"viewers","project_creation_level":"developer","full_name":"Viewers","full_path":"viewers","created_at":"2022-09-13T19:38:25.777Z"}`
	// serverAdminGroup = `{"id":7,"web_url":"http://grafana-gitlab.local/groups/serveradmins","name":"ServerAdmins","path":"serveradmins","project_creation_level":"developer","full_name":"ServerAdmins","full_path":"serveradmins","created_at":"2022-09-13T19:38:36.227Z"}`
)

func TestSocialGitlab_UserInfo(t *testing.T) {
	var nilPointer *bool
	provider := SocialGitlab{
		SocialBase: &SocialBase{
			log: newLogger("gitlab_oauth_test", "debug"),
		},
		skipOrgRoleSync: false,
	}

	type conf struct {
		AllowAssignGrafanaAdmin bool
		RoleAttributeStrict     bool
		AutoAssignOrgRole       org.RoleType
		SkipOrgRoleSync         bool
	}

	tests := []struct {
		Name                 string
		Cfg                  conf
		UserRespBody         string
		GroupsRespBody       string
		GroupHeaders         map[string]string
		RoleAttributePath    string
		ExpectedLogin        string
		ExpectedEmail        string
		ExpectedRole         org.RoleType
		ExpectedGrafanaAdmin *bool
		ExpectedError        error
	}{
		{
			Name:           "Server Admin Allowed",
			Cfg:            conf{AllowAssignGrafanaAdmin: true},
			UserRespBody:   rootUserRespBody,
			GroupsRespBody: "[" + strings.Join([]string{adminGroup, editorGroup, viewerGroup}, ",") + "]",
			GroupHeaders: map[string]string{
				"X-Total-Pages": "1",
				"X-Total":       "3",
				"X-Page":        "1",
				"X-Next-Page":   "",
			},
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "root",
			ExpectedEmail:        "root@example.org",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: trueBoolPtr(),
		},
		{ // Edge case, user in Viewer Group, Server Admin disabled but attribute path contains a condition for Server Admin => User has the Admin role
			Name:           "Server Admin Disabled",
			Cfg:            conf{AllowAssignGrafanaAdmin: false},
			UserRespBody:   rootUserRespBody,
			GroupsRespBody: "[" + strings.Join([]string{adminGroup, editorGroup, viewerGroup}, ",") + "]",
			GroupHeaders: map[string]string{
				"X-Total-Pages": "1",
				"X-Total":       "3",
				"X-Page":        "1",
				// Next page omitted to test that the provider does not make a second request
			},
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "root",
			ExpectedEmail:        "root@example.org",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: nil,
		},
		{
			Name:                 "Editor",
			Cfg:                  conf{AllowAssignGrafanaAdmin: true},
			UserRespBody:         editorUserRespBody,
			GroupsRespBody:       "[" + strings.Join([]string{viewerGroup, editorGroup}, ",") + "]",
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "gitlab-editor",
			ExpectedEmail:        "gitlab-editor@example.org",
			ExpectedRole:         "Editor",
			ExpectedGrafanaAdmin: falseBoolPtr(),
			GroupHeaders:         map[string]string{
				// All headers omitted to test that the provider does not make a second request
			},
		},
		{
			Name:                 "Should not sync role, return empty role and nil pointer for GrafanaAdmin for skip org role sync set to true",
			Cfg:                  conf{SkipOrgRoleSync: true},
			UserRespBody:         editorUserRespBody,
			GroupsRespBody:       "[" + strings.Join([]string{viewerGroup, editorGroup}, ",") + "]",
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "gitlab-editor",
			ExpectedEmail:        "gitlab-editor@example.org",
			ExpectedRole:         "",
			ExpectedGrafanaAdmin: nilPointer,
		},
		{ // Fallback to autoAssignOrgRole
			Name:              "No fallback to default org role",
			Cfg:               conf{AutoAssignOrgRole: org.RoleAdmin},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{}, ",") + "]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedLogin:     "gitlab-editor",
			ExpectedEmail:     "gitlab-editor@example.org",
			ExpectedRole:      "Admin",
		},
		{
			Name:              "Strict mode prevents fallback to default",
			Cfg:               conf{RoleAttributeStrict: true, AutoAssignOrgRole: org.RoleAdmin},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{}, ",") + "]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedError:     errRoleAttributeStrictViolation,
		},
		{ // Edge case, no match, no strict mode and no fallback => User has the Viewer role (hard coded)
			Name:              "Fallback with no default will create a user with a default role",
			Cfg:               conf{},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedLogin:     "gitlab-editor",
			ExpectedEmail:     "gitlab-editor@example.org",
			ExpectedRole:      "Viewer",
		},
		{ // Edge case, no attribute path with strict mode => Error
			Name:              "Strict mode with no attribute path",
			Cfg:               conf{RoleAttributeStrict: true, AutoAssignOrgRole: org.RoleViewer},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{editorGroup}, ",") + "]",
			RoleAttributePath: "",
			ExpectedError:     errRoleAttributePathNotSet,
		},
	}

	for _, test := range tests {
		provider.roleAttributePath = test.RoleAttributePath
		provider.allowAssignGrafanaAdmin = test.Cfg.AllowAssignGrafanaAdmin
		provider.autoAssignOrgRole = string(test.Cfg.AutoAssignOrgRole)
		provider.roleAttributeStrict = test.Cfg.RoleAttributeStrict
		provider.skipOrgRoleSync = test.Cfg.SkipOrgRoleSync

		t.Run(test.Name, func(t *testing.T) {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Header().Set("Content-Type", "application/json")
				switch r.RequestURI {
				case userURI:
					w.WriteHeader(http.StatusOK)
					_, err := w.Write([]byte(test.UserRespBody))
					require.NoError(t, err)
				case groupsURI:
					w.WriteHeader(http.StatusOK)
					for k, v := range test.GroupHeaders {
						w.Header().Set(k, v)
					}
					_, err := w.Write([]byte(test.GroupsRespBody))
					require.NoError(t, err)
				default:
					require.Fail(t, "unexpected request URI: "+r.RequestURI)
				}
			}))
			provider.apiUrl = ts.URL + apiURI
			actualResult, err := provider.UserInfo(context.Background(), ts.Client(), &oauth2.Token{})
			if test.ExpectedError != nil {
				require.ErrorIs(t, err, test.ExpectedError)
				return
			}

			require.NoError(t, err)
			require.Equal(t, test.ExpectedEmail, actualResult.Email)
			require.Equal(t, test.ExpectedLogin, actualResult.Login)
			require.Equal(t, test.ExpectedRole, actualResult.Role)
			require.Equal(t, test.ExpectedGrafanaAdmin, actualResult.IsGrafanaAdmin)
		})
	}
}

type testCase struct {
	name           string
	payload        string
	config         *oauth2.Config
	wantUser       *userData
	wantErrMessage string
}

func TestSocialGitlab_extractFromToken(t *testing.T) {
	// Create a test server that returns a dummy ID token and user info
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/token":
			// Return a dummy access token
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token": "dummy_access_token",
				"token_type":   "Bearer",
			})
		case "/oauth/userinfo":
			// Return a dummy user info
			_ = json.NewEncoder(w).Encode(userInfoResponse{
				Sub:           "12345678",
				EmailVerified: true,
				Groups:        []string{"admins", "editors", "viewers"},
			})
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	}))
	defer ts.Close()

	testCases := []testCase{
		{
			name: "successful extraction",
			payload: `{
                "iss": "https://gitlab.com",
                "sub": "12345678",
                "aud": "d77db857f4696c5c5ff6cee64f3ed26e709aac8f1c644dc4b9d5fd64f825d583",
                "exp": 1686124040,
                "iat": 1686123920,
                "auth_time": 1686119303,
                "sub_legacy": "b4359d63eaf90d4b1f3d71d291353b75a676bf73fdf734d4ff009eca5c69bb70",
                "name": "John Doe",
                "nickname": "johndoe",
                "preferred_username": "johndoe",
                "email": "johndoe@example.com",
                "email_verified": true,
                "profile": "https://gitlab.com/johndoe",
                "picture": "https://gitlab.com/uploads/-/system/user/avatar/1234567/avatar.png",
                "groups_direct": [
                  "admins"
                ]
            }`,
			config: &oauth2.Config{
				Endpoint: oauth2.Endpoint{
					AuthURL:  ts.URL + "/oauth/authorize",
					TokenURL: ts.URL + "/oauth/token",
				},
			},
			wantUser: &userData{
				ID:             "12345678",
				Login:          "johndoe",
				Email:          "johndoe@example.com",
				Name:           "John Doe",
				Groups:         []string{"admins", "editors", "viewers"},
				EmailVerified:  true,
				Role:           "Viewer",
				IsGrafanaAdmin: nil,
			},
		},
		{
			name: "unverified email",
			payload: `{
                "iss": "https://gitlab.com",
                "sub": "12345678",
                "aud": "d77db857f4696c5c5ff6cee64f3ed26e709aac8f1c644dc4b9d5fd64f825d583",
                "exp": 1686124040,
                "iat": 1686123920,
                "auth_time": 1686119303,
                "sub_legacy": "b4359d63eaf90d4b1f3d71d291353b75a676bf73fdf734d4ff009eca5c69bb70",
                "name": "John Doe",
                "nickname": "johndoe",
                "preferred_username": "johndoe",
                "email": "johndoe@example.com",
                "email_verified": false,
                "profile": "https://gitlab.com/johndoe",
                "picture": "https://gitlab.com/uploads/-/system/user/avatar/1234567/avatar.png",
                "groups_direct": [
                  "admins"
                ]
            }`,
			config: &oauth2.Config{
				Endpoint: oauth2.Endpoint{
					AuthURL:  ts.URL + "/oauth/authorize",
					TokenURL: ts.URL + "/oauth/token",
				},
			},
			wantErrMessage: "user johndoe's email is not confirmed",
		},
		{
			name: "unable to reach userinfo endpoint",
			payload: `{
                "iss": "https://gitlab.com",
                "sub": "12345678",
                "aud": "d77db857f4696c5c5ff6cee64f3ed26e709aac8f1c644dc4b9d5fd64f825d583",
                "exp": 1686124040,
                "iat": 1686123920,
                "auth_time": 1686119303,
                "sub_legacy": "b4359d63eaf90d4b1f3d71d291353b75a676bf73fdf734d4ff009eca5c69bb70",
                "name": "John Doe",
                "nickname": "johndoe",
                "preferred_username": "johndoe",
                "email": "johndoe@example.com",
                "email_verified": true,
                "profile": "https://gitlab.com/johndoe",
                "picture": "https://gitlab.com/uploads/-/system/user/avatar/1234567/avatar.png",
                "groups_direct": [
                  "admins"
                ]
            }`,
			config: &oauth2.Config{
				Endpoint: oauth2.Endpoint{
					AuthURL:  "http://localhost:1234/oauth/authorize",
					TokenURL: "http://localhost:1234/oauth/token",
				},
			},
			wantUser: &userData{
				ID:             "12345678",
				Login:          "johndoe",
				Email:          "johndoe@example.com",
				Name:           "John Doe",
				Groups:         []string{"admins"},
				EmailVerified:  true,
				Role:           "Viewer",
				IsGrafanaAdmin: nil,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a test client with a dummy token
			client := oauth2.NewClient(context.Background(), &tokenSource{accessToken: "dummy_access_token"})

			// Create a test SocialGitlab instance
			s := &SocialGitlab{
				SocialBase: &SocialBase{
					Config:              tc.config,
					log:                 newLogger("test", "debug"),
					allowSignup:         false,
					allowedDomains:      []string{},
					roleAttributePath:   "",
					roleAttributeStrict: false,
					autoAssignOrgRole:   "",
					skipOrgRoleSync:     false,
				},
				skipOrgRoleSync: false,
			}

			// Test case: successful extraction
			token := &oauth2.Token{}
			// build jwt
			// header
			header := map[string]interface{}{
				"alg": "RS256",
				"typ": "JWT",
				"kid": "dummy",
			}
			headerJSON, err := json.Marshal(header)
			require.NoError(t, err)
			headerEncoded := base64.RawURLEncoding.EncodeToString(headerJSON)
			// payload
			payloadEncoded := base64.RawURLEncoding.EncodeToString([]byte(tc.payload))
			// signature
			signatureEncoded := base64.RawURLEncoding.EncodeToString([]byte("dummy"))
			// build token
			idToken := fmt.Sprintf("%s.%s.%s", headerEncoded, payloadEncoded, signatureEncoded)

			token = token.WithExtra(map[string]interface{}{"id_token": idToken})
			data, err := s.extractFromToken(context.Background(), client, token)
			if tc.wantErrMessage != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErrMessage)
			} else {
				require.NotNil(t, data)
				require.NoError(t, err)
				assert.Equal(t, tc.wantUser, data)
			}
		})
	}
}

// tokenSource is a dummy oauth2.TokenSource that always returns a fixed access token
type tokenSource struct {
	accessToken string
}

func (t *tokenSource) Token() (*oauth2.Token, error) {
	return &oauth2.Token{
		AccessToken: t.accessToken,
		TokenType:   "Bearer",
	}, nil
}

func TestSocialGitlab_GetGroupsNextPage(t *testing.T) {
	type Group struct {
		FullPath string `json:"full_path"`
	}

	groups := []Group{
		{FullPath: "admins"},
		{FullPath: "editors"},
		{FullPath: "viewers"},
		{FullPath: "serveradmins"},
	}

	calls := 0
	// Create a mock HTTP client and server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/groups" {
			// Return a paginated response with 2 groups per page
			page, err := strconv.Atoi(r.URL.Query().Get("page"))
			require.NoError(t, err)
			perPage := 2
			startIndex := (page - 1) * perPage
			endIndex := startIndex + perPage
			if endIndex > len(groups) {
				endIndex = len(groups)
			}
			groupsPage := groups[startIndex:endIndex]
			jsonBytes, err := json.Marshal(groupsPage)
			require.NoError(t, err)

			w.Header().Set("X-Total", strconv.Itoa(len(groups)))
			if endIndex < len(groups) {
				w.Header().Set("X-Next-Page", strconv.Itoa(page+1))
			}
			calls += 1
			_, err = w.Write(jsonBytes)
			require.NoError(t, err)
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer mockServer.Close()

	// Create a SocialGitlab instance with the mock server URL
	s := &SocialGitlab{
		apiUrl: mockServer.URL,
		SocialBase: &SocialBase{
			log: newLogger("test", "debug"),
		},
	}

	// Call getGroups and verify that it returns all groups
	expectedGroups := []string{"admins", "editors", "viewers", "serveradmins"}
	actualGroups := s.getGroups(context.Background(), mockServer.Client())
	assert.Equal(t, expectedGroups, actualGroups)
	assert.Equal(t, 2, calls)
}
