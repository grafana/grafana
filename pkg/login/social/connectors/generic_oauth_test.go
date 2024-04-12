package connectors

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserInfoSearchesForEmailAndRole(t *testing.T) {
	provider := NewGenericOAuthProvider(&social.OAuthInfo{
		EmailAttributePath: "email",
	}, &setting.Cfg{},
		&ssosettingstests.MockService{},
		featuremgmt.WithFeatures())

	tests := []struct {
		Name                    string
		SkipOrgRoleSync         bool
		AllowAssignGrafanaAdmin bool
		ResponseBody            any
		OAuth2Extra             any
		RoleAttributePath       string
		ExpectedEmail           string
		ExpectedRole            org.RoleType
		ExpectedError           error
		ExpectedGrafanaAdmin    *bool
	}{
		{
			Name: "Given a valid id_token, a valid role path, no API response, use id_token",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
			},
			RoleAttributePath: "role",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Admin",
		},
		{
			Name: "Given a valid id_token, no role path, no API response, use id_token",
			OAuth2Extra: map[string]any{
				// { "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
			},
			RoleAttributePath: "",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Viewer",
		},
		{
			Name: "Given a valid id_token, an invalid role path, no API response, use id_token",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
			},
			RoleAttributePath: "invalid_path",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Viewer",
		},
		{
			Name: "Given no id_token, a valid role path, a valid API response, use API response",
			ResponseBody: map[string]any{
				"role":  "Admin",
				"email": "john.doe@example.com",
			},
			RoleAttributePath: "role",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Admin",
		},
		{
			Name: "Given no id_token, no role path, a valid API response, use API response",
			ResponseBody: map[string]any{
				"email": "john.doe@example.com",
			},
			RoleAttributePath: "",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Viewer",
		},
		{
			Name: "Given no id_token, a role path, a valid API response without a role, use API response",
			ResponseBody: map[string]any{
				"email": "john.doe@example.com",
			},
			RoleAttributePath: "role",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Viewer",
		},
		{
			Name:              "Given no id_token, a valid role path, no API response, no data",
			RoleAttributePath: "role",
			ExpectedEmail:     "",
			ExpectedRole:      "Viewer",
		},
		{
			Name: "Given a valid id_token, a valid role path, a valid API response, prefer id_token",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
			},
			ResponseBody: map[string]any{
				"role":  "FromResponse",
				"email": "from_response@example.com",
			},
			RoleAttributePath: "role",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Admin",
		},
		{
			Name:                    "Given a valid id_token and AssignGrafanaAdmin is unchecked, don't grant Server Admin",
			AllowAssignGrafanaAdmin: false,
			OAuth2Extra: map[string]any{
				// { "role": "GrafanaAdmin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiR3JhZmFuYUFkbWluIiwiZW1haWwiOiJqb2huLmRvZUBleGFtcGxlLmNvbSJ9.cQqMJpVjwdtJ8qEZLOo9RKNbAFfpkQcpnRG0nopmWEI",
			},
			ResponseBody: map[string]any{
				"role":  "FromResponse",
				"email": "from_response@example.com",
			},
			RoleAttributePath:    "role",
			ExpectedEmail:        "john.doe@example.com",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: nil,
		},
		{
			Name:                    "Given a valid id_token and AssignGrafanaAdmin is checked, grant Server Admin",
			AllowAssignGrafanaAdmin: true,
			OAuth2Extra: map[string]any{
				// { "role": "GrafanaAdmin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiR3JhZmFuYUFkbWluIiwiZW1haWwiOiJqb2huLmRvZUBleGFtcGxlLmNvbSJ9.cQqMJpVjwdtJ8qEZLOo9RKNbAFfpkQcpnRG0nopmWEI",
			},
			ResponseBody: map[string]any{
				"role":  "FromResponse",
				"email": "from_response@example.com",
			},
			RoleAttributePath:    "role",
			ExpectedEmail:        "john.doe@example.com",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: trueBoolPtr(),
		},
		{
			Name: "Given a valid id_token, an invalid role path, a valid API response, prefer id_token",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
			},
			ResponseBody: map[string]any{
				"role":  "FromResponse",
				"email": "from_response@example.com",
			},
			RoleAttributePath: "invalid_path",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Viewer",
		},
		{
			Name: "Given a valid id_token with no email, a valid role path, a valid API response with no role, merge",
			OAuth2Extra: map[string]any{
				// { "role": "Admin" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4ifQ.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
			},
			ResponseBody: map[string]any{
				"email": "from_response@example.com",
			},
			RoleAttributePath: "role",
			ExpectedEmail:     "from_response@example.com",
			ExpectedRole:      "Admin",
		},
		{
			Name: "Given a valid id_token with no role, a valid role path, a valid API response with no email, merge",
			OAuth2Extra: map[string]any{
				// { "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
			},
			ResponseBody: map[string]any{
				"role": "FromResponse",
			},
			RoleAttributePath: "role",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Viewer",
			ExpectedError:     nil,
		},
		{
			Name: "Given a valid id_token, a valid advanced JMESPath role path, derive the role",
			OAuth2Extra: map[string]any{
				// { "email": "john.doe@example.com",
				//   "info": { "roles": [ "dev", "engineering" ] }}
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwiaW5mbyI6eyJyb2xlcyI6WyJkZXYiLCJlbmdpbmVlcmluZyJdfX0.RmmQfv25eXb4p3wMrJsvXfGQ6EXhGtwRXo6SlCFHRNg",
			},
			RoleAttributePath: "contains(info.roles[*], 'dev') && 'Editor'",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Editor",
		},
		{
			Name: "Given a valid id_token without role info, a valid advanced JMESPath role path, a valid API response, derive the correct role using the userinfo API response (JMESPath warning on id_token)",
			OAuth2Extra: map[string]any{
				// { "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
			},
			ResponseBody: map[string]any{
				"info": map[string]any{
					"roles": []string{"engineering", "SRE"},
				},
			},
			RoleAttributePath: "contains(info.roles[*], 'SRE') && 'Admin'",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Admin",
		},
		{
			Name: "Given a valid id_token, a valid advanced JMESPath role path, a valid API response, prefer ID token",
			OAuth2Extra: map[string]any{
				// { "email": "john.doe@example.com",
				//   "info": { "roles": [ "dev", "engineering" ] }}
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwiaW5mbyI6eyJyb2xlcyI6WyJkZXYiLCJlbmdpbmVlcmluZyJdfX0.RmmQfv25eXb4p3wMrJsvXfGQ6EXhGtwRXo6SlCFHRNg",
			},
			ResponseBody: map[string]any{
				"info": map[string]any{
					"roles": []string{"engineering", "SRE"},
				},
			},
			RoleAttributePath: "contains(info.roles[*], 'SRE') && 'Admin' || contains(info.roles[*], 'dev') && 'Editor' || 'Viewer'",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "Editor",
		},
		{
			Name:            "Given skip org role sync set to true, with a valid id_token, a valid advanced JMESPath role path, a valid API response, no org role should be set",
			SkipOrgRoleSync: true,
			OAuth2Extra: map[string]any{
				// { "email": "john.doe@example.com",
				//   "info": { "roles": [ "dev", "engineering" ] }}
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwiaW5mbyI6eyJyb2xlcyI6WyJkZXYiLCJlbmdpbmVlcmluZyJdfX0.RmmQfv25eXb4p3wMrJsvXfGQ6EXhGtwRXo6SlCFHRNg",
			},
			ResponseBody: map[string]any{
				"info": map[string]any{
					"roles": []string{"engineering", "SRE"},
				},
			},
			RoleAttributePath: "contains(info.roles[*], 'SRE') && 'Admin' || contains(info.roles[*], 'dev') && 'Editor' || 'Viewer'",
			ExpectedEmail:     "john.doe@example.com",
			ExpectedRole:      "",
		},
	}

	for _, test := range tests {
		provider.info.RoleAttributePath = test.RoleAttributePath
		provider.info.AllowAssignGrafanaAdmin = test.AllowAssignGrafanaAdmin
		provider.info.SkipOrgRoleSync = test.SkipOrgRoleSync

		t.Run(test.Name, func(t *testing.T) {
			body, err := json.Marshal(test.ResponseBody)
			require.NoError(t, err)
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Header().Set("Content-Type", "application/json")
				_, err = w.Write(body)
				require.NoError(t, err)
			}))
			provider.info.ApiUrl = ts.URL
			staticToken := oauth2.Token{
				AccessToken:  "",
				TokenType:    "",
				RefreshToken: "",
				Expiry:       time.Now(),
			}

			token := staticToken.WithExtra(test.OAuth2Extra)
			actualResult, err := provider.UserInfo(context.Background(), ts.Client(), token)
			if test.ExpectedError != nil {
				require.ErrorIs(t, err, test.ExpectedError)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.ExpectedEmail, actualResult.Email)
			require.Equal(t, test.ExpectedEmail, actualResult.Login)
			require.Equal(t, test.ExpectedRole, actualResult.Role)
			require.Equal(t, test.ExpectedGrafanaAdmin, actualResult.IsGrafanaAdmin)
		})
	}
}

func TestUserInfoSearchesForLogin(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := NewGenericOAuthProvider(&social.OAuthInfo{
			Extra: map[string]string{
				"login_attribute_path": "login",
			},
		}, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

		tests := []struct {
			Name               string
			ResponseBody       any
			OAuth2Extra        any
			LoginAttributePath string
			ExpectedLogin      string
		}{
			{
				Name: "Given a valid id_token, a valid login path, no API response, use id_token",
				OAuth2Extra: map[string]any{
					// { "login": "johndoe", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6ImpvaG5kb2UiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.sg4sRJCNpax_76XMgr277fdxhjjtNSWXKIOFv4_GJN8",
				},
				LoginAttributePath: "role",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given a valid id_token, no login path, no API response, use id_token",
				OAuth2Extra: map[string]any{
					// { "login": "johndoe", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6ImpvaG5kb2UiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.sg4sRJCNpax_76XMgr277fdxhjjtNSWXKIOFv4_GJN8",
				},
				LoginAttributePath: "",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given no id_token, a valid login path, a valid API response, use API response",
				ResponseBody: map[string]any{
					"user_uid": "johndoe",
					"email":    "john.doe@example.com",
				},
				LoginAttributePath: "user_uid",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given no id_token, no login path, a valid API response, use API response",
				ResponseBody: map[string]any{
					"login": "johndoe",
				},
				LoginAttributePath: "",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given no id_token, a login path, a valid API response without a login, use API response",
				ResponseBody: map[string]any{
					"username": "john.doe",
				},
				LoginAttributePath: "login",
				ExpectedLogin:      "john.doe",
			},
			{
				Name:               "Given no id_token, a valid login path, no API response, no data",
				LoginAttributePath: "login",
				ExpectedLogin:      "",
			},
		}

		for _, test := range tests {
			provider.loginAttributePath = test.LoginAttributePath
			t.Run(test.Name, func(t *testing.T) {
				body, err := json.Marshal(test.ResponseBody)
				require.NoError(t, err)
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					t.Log("Writing fake API response body", "body", test.ResponseBody)
					_, err = w.Write(body)
					require.NoError(t, err)
				}))
				provider.info.ApiUrl = ts.URL
				staticToken := oauth2.Token{
					AccessToken:  "",
					TokenType:    "",
					RefreshToken: "",
					Expiry:       time.Now(),
				}

				token := staticToken.WithExtra(test.OAuth2Extra)
				actualResult, err := provider.UserInfo(context.Background(), ts.Client(), token)
				require.NoError(t, err)
				require.Equal(t, test.ExpectedLogin, actualResult.Login)
			})
		}
	})
}

func TestUserInfoSearchesForName(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := NewGenericOAuthProvider(&social.OAuthInfo{
			Extra: map[string]string{
				"name_attribute_path": "name",
			},
		}, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

		tests := []struct {
			Name              string
			ResponseBody      any
			OAuth2Extra       any
			NameAttributePath string
			ExpectedName      string
		}{
			{
				Name: "Given a valid id_token, a valid name path, no API response, use id_token",
				OAuth2Extra: map[string]any{
					// { "name": "John Doe", "login": "johndoe", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6ImpvaG5kb2UiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwibmFtZSI6IkpvaG4gRG9lIn0.oMsXH0mHxUSYMXh6FonZIWh8LgNIcYbKRLSO1bwnfSI",
				},
				NameAttributePath: "name",
				ExpectedName:      "John Doe",
			},
			{
				Name: "Given a valid id_token, no name path, no API response, use id_token",
				OAuth2Extra: map[string]any{
					// { "name": "John Doe", "login": "johndoe", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6ImpvaG5kb2UiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwibmFtZSI6IkpvaG4gRG9lIn0.oMsXH0mHxUSYMXh6FonZIWh8LgNIcYbKRLSO1bwnfSI",
				},
				NameAttributePath: "",
				ExpectedName:      "John Doe",
			},
			{
				Name: "Given no id_token, a valid name path, a valid API response, use API response",
				ResponseBody: map[string]any{
					"user_name": "John Doe",
					"login":     "johndoe",
					"email":     "john.doe@example.com",
				},
				NameAttributePath: "user_name",
				ExpectedName:      "John Doe",
			},
			{
				Name: "Given no id_token, no name path, a valid API response, use API response",
				ResponseBody: map[string]any{
					"display_name": "John Doe",
					"login":        "johndoe",
				},
				NameAttributePath: "",
				ExpectedName:      "John Doe",
			},
			{
				Name: "Given no id_token, a name path, a valid API response without a name, use API response",
				ResponseBody: map[string]any{
					"display_name": "John Doe",
					"username":     "john.doe",
				},
				NameAttributePath: "name",
				ExpectedName:      "John Doe",
			},
			{
				Name:              "Given no id_token, a valid name path, no API response, no data",
				NameAttributePath: "name",
				ExpectedName:      "",
			},
		}

		for _, test := range tests {
			provider.nameAttributePath = test.NameAttributePath
			t.Run(test.Name, func(t *testing.T) {
				body, err := json.Marshal(test.ResponseBody)
				require.NoError(t, err)
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					t.Log("Writing fake API response body", "body", test.ResponseBody)
					_, err = w.Write(body)
					require.NoError(t, err)
				}))
				provider.info.ApiUrl = ts.URL
				staticToken := oauth2.Token{
					AccessToken:  "",
					TokenType:    "",
					RefreshToken: "",
					Expiry:       time.Now(),
				}

				token := staticToken.WithExtra(test.OAuth2Extra)
				actualResult, err := provider.UserInfo(context.Background(), ts.Client(), token)
				require.NoError(t, err)
				require.Equal(t, test.ExpectedName, actualResult.Name)
			})
		}
	})
}

func TestUserInfoSearchesForGroup(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		tests := []struct {
			name                string
			groupsAttributePath string
			responseBody        any
			expectedResult      []string
		}{
			{
				name:                "If groups are not set, user groups are nil",
				groupsAttributePath: "",
				expectedResult:      nil,
			},
			{
				name:                "If groups are empty, user groups are nil",
				groupsAttributePath: "info.groups",
				responseBody: map[string]any{
					"info": map[string]any{
						"groups": []string{},
					},
				},
				expectedResult: nil,
			},
			{
				name:                "If groups are set, user groups are set",
				groupsAttributePath: "info.groups",
				responseBody: map[string]any{
					"info": map[string]any{
						"groups": []string{"foo", "bar"},
					},
				},
				expectedResult: []string{"foo", "bar"},
			},
		}

		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				body, err := json.Marshal(test.responseBody)
				require.NoError(t, err)
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					t.Log("Writing fake API response body", "body", test.responseBody)
					_, err := w.Write(body)
					require.NoError(t, err)
				}))

				provider := NewGenericOAuthProvider(&social.OAuthInfo{
					GroupsAttributePath: test.groupsAttributePath,
					ApiUrl:              ts.URL,
				}, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

				token := &oauth2.Token{
					AccessToken:  "",
					TokenType:    "",
					RefreshToken: "",
					Expiry:       time.Now(),
				}

				userInfo, err := provider.UserInfo(context.Background(), ts.Client(), token)
				assert.NoError(t, err)
				assert.Equal(t, test.expectedResult, userInfo.Groups)
			})
		}
	})
}

func TestPayloadCompression(t *testing.T) {
	provider := NewGenericOAuthProvider(&social.OAuthInfo{
		EmailAttributePath: "email",
	}, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

	tests := []struct {
		Name          string
		OAuth2Extra   any
		ExpectedEmail string
	}{
		{
			Name: "Given a valid DEFLATE compressed id_token, return userInfo",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInppcCI6IkRFRiJ9.eJyrVkrNTczMUbJSysrPyNNLyU91SK1IzC3ISdVLzs9V0lEqys9JBco6puRm5inVAgCFRw_6.XrV4ZKhw19dTcnviXanBD8lwjeALCYtDiESMmGzC-ho",
			},
			ExpectedEmail: "john.doe@example.com",
		},
		{
			Name: "Given a valid DEFLATE compressed id_token with numeric header, return userInfo",
			OAuth2Extra: map[string]any{
				// Generated from https://token.dev/
				"id_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInZlciI6NH0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTY0MjUxNjYwNSwiZXhwIjoxNjQyNTIwMjA1LCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.ANndoPWIHNjKPG8na7UUq7nan1RgF8-ze8STU31RXcA",
			},
			ExpectedEmail: "john.doe@example.com",
		},
		{
			Name: "Given an invalid DEFLATE compressed id_token, return nil",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInppcCI6IkRFRiJ9.00eJyrVkrNTczMUbJSysrPyNNLyU91SK1IzC3ISdVLzs9V0lEqys9JBco6puRm5inVAgCFRw_6.XrV4ZKhw19dTcnviXanBD8lwjeALCYtDiESMmGzC-ho",
			},
			ExpectedEmail: "",
		},
		{
			Name: "Given an unsupported GZIP compressed id_token, return nil",
			OAuth2Extra: map[string]any{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInppcCI6IkdaSVAifQ.H4sIAAAAAAAAAKtWSs1NzMxRslLKys_I00vJT3VIrUjMLchJ1UvOz1XSUSrKz0kFyjqm5GbmKdUCANotxTkvAAAA.85AXm3JOF5qflEA0goDFvlbZl2q3eFvqVcehz860W-o",
			},
			ExpectedEmail: "",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			staticToken := oauth2.Token{
				AccessToken:  "",
				TokenType:    "",
				RefreshToken: "",
				Expiry:       time.Now(),
			}

			token := staticToken.WithExtra(test.OAuth2Extra)
			userInfo := provider.extractFromToken(token)

			if test.ExpectedEmail == "" {
				require.Nil(t, userInfo, "Testing case %q", test.Name)
			} else {
				require.NotNil(t, userInfo, "Testing case %q", test.Name)
				require.Equal(t, test.ExpectedEmail, userInfo.Email)
			}
		})
	}
}

func TestSocialGenericOAuth_InitializeExtraFields(t *testing.T) {
	type settingFields struct {
		nameAttributePath    string
		loginAttributePath   string
		idTokenAttributeName string
		teamIds              []string
		allowedOrganizations []string
	}
	testCases := []struct {
		name     string
		settings *social.OAuthInfo
		want     settingFields
	}{
		{
			name: "nameAttributePath is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"name_attribute_path": "name",
				},
			},
			want: settingFields{
				nameAttributePath:    "name",
				loginAttributePath:   "",
				idTokenAttributeName: "",
				teamIds:              []string{},
				allowedOrganizations: []string{},
			},
		},
		{
			name: "loginAttributePath is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"login_attribute_path": "login",
				},
			},
			want: settingFields{
				nameAttributePath:    "",
				loginAttributePath:   "login",
				idTokenAttributeName: "",
				teamIds:              []string{},
				allowedOrganizations: []string{},
			},
		},
		{
			name: "idTokenAttributeName is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"id_token_attribute_name": "id_token",
				},
			},
			want: settingFields{
				nameAttributePath:    "",
				loginAttributePath:   "",
				idTokenAttributeName: "id_token",
				teamIds:              []string{},
				allowedOrganizations: []string{},
			},
		},
		{
			name: "teamIds is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"team_ids": "[\"team1\", \"team2\"]",
				},
			},
			want: settingFields{
				nameAttributePath:    "",
				loginAttributePath:   "",
				idTokenAttributeName: "",
				teamIds:              []string{"team1", "team2"},
				allowedOrganizations: []string{},
			},
		},
		{
			name: "allowedOrganizations is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"allowed_organizations": "org1, org2",
				},
			},
			want: settingFields{
				nameAttributePath:    "",
				loginAttributePath:   "",
				idTokenAttributeName: "",
				teamIds:              []string{},
				allowedOrganizations: []string{"org1", "org2"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGenericOAuthProvider(tc.settings, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

			require.Equal(t, tc.want.nameAttributePath, s.nameAttributePath)
			require.Equal(t, tc.want.loginAttributePath, s.loginAttributePath)
			require.Equal(t, tc.want.idTokenAttributeName, s.idTokenAttributeName)
			require.Equal(t, tc.want.teamIds, s.teamIds)
			require.Equal(t, tc.want.allowedOrganizations, s.allowedOrganizations)
		})
	}
}

func TestSocialGenericOAuth_Validate(t *testing.T) {
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
					"teams_url":                  "https://example.com/teams",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
				},
			},
			requester: &user.SignedInUser{IsGrafanaAdmin: true},
		},
		{
			name: "passes when team_url is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"teams_url": "",
					"auth_url":  "https://example.com/auth",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: nil,
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
					"skip_org_role_sync":         "true",
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
					"teams_url": "https://example.com/teams",
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
					"teams_url": "https://example.com/teams",
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
					"teams_url": "https://example.com/teams",
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
					"teams_url": "https://example.com/teams",
					"auth_url":  "https://example.com/auth",
					"token_url": "/path",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if teams url is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"teams_url": "file://teams",
					"auth_url":  "https://example.com/auth",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGenericOAuthProvider(&social.OAuthInfo{}, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

			if tc.requester == nil {
				tc.requester = &user.SignedInUser{IsGrafanaAdmin: false}
			}
			err := s.Validate(context.Background(), tc.settings, tc.requester)
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestSocialGenericOAuth_Reload(t *testing.T) {
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
				RedirectURL: "/login/generic_oauth",
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
				RedirectURL:  "/login/generic_oauth",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGenericOAuthProvider(tc.info, &setting.Cfg{}, &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

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

func TestGenericOAuth_Reload_ExtraFields(t *testing.T) {
	testCases := []struct {
		name                         string
		settings                     ssoModels.SSOSettings
		info                         *social.OAuthInfo
		expectError                  bool
		expectedInfo                 *social.OAuthInfo
		expectedTeamsUrl             string
		expectedEmailAttributeName   string
		expectedEmailAttributePath   string
		expectedNameAttributePath    string
		expectedGroupsAttributePath  string
		expectedLoginAttributePath   string
		expectedIdTokenAttributeName string
		expectedTeamIdsAttributePath string
		expectedTeamIds              []string
		expectedAllowedOrganizations []string
	}{
		{
			name: "successfully reloads the settings",
			info: &social.OAuthInfo{
				ClientId:             "client-id",
				ClientSecret:         "client-secret",
				TeamsUrl:             "https://host/users",
				EmailAttributePath:   "email-attr-path",
				EmailAttributeName:   "email-attr-name",
				GroupsAttributePath:  "groups-attr-path",
				TeamIdsAttributePath: "team-ids-attr-path",
				Extra: map[string]string{
					teamIdsKey:              "team1",
					allowedOrganizationsKey: "org1",
					loginAttributePathKey:   "login-attr-path",
					idTokenAttributeNameKey: "id-token-attr-name",
					nameAttributePathKey:    "name-attr-path",
				},
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":               "new-client-id",
					"client_secret":           "new-client-secret",
					"teams_url":               "https://host/v2/users",
					"email_attribute_path":    "new-email-attr-path",
					"email_attribute_name":    "new-email-attr-name",
					"groups_attribute_path":   "new-group-attr-path",
					"team_ids_attribute_path": "new-team-ids-attr-path",
					teamIdsKey:                "team1,team2",
					allowedOrganizationsKey:   "org1,org2",
					loginAttributePathKey:     "new-login-attr-path",
					idTokenAttributeNameKey:   "new-id-token-attr-name",
					nameAttributePathKey:      "new-name-attr-path",
				},
			},
			expectedInfo: &social.OAuthInfo{
				ClientId:             "new-client-id",
				ClientSecret:         "new-client-secret",
				TeamsUrl:             "https://host/v2/users",
				EmailAttributePath:   "new-email-attr-path",
				EmailAttributeName:   "new-email-attr-name",
				GroupsAttributePath:  "new-group-attr-path",
				TeamIdsAttributePath: "new-team-ids-attr-path",
				Extra: map[string]string{
					teamIdsKey:              "team1,team2",
					allowedOrganizationsKey: "org1,org2",
					loginAttributePathKey:   "new-login-attr-path",
					idTokenAttributeNameKey: "new-id-token-attr-name",
					nameAttributePathKey:    "new-name-attr-path",
				},
			},
			expectedTeamsUrl:             "https://host/v2/users",
			expectedEmailAttributeName:   "new-email-attr-name",
			expectedEmailAttributePath:   "new-email-attr-path",
			expectedGroupsAttributePath:  "new-group-attr-path",
			expectedTeamIdsAttributePath: "new-team-ids-attr-path",
			expectedTeamIds:              []string{"team1", "team2"},
			expectedAllowedOrganizations: []string{"org1", "org2"},
			expectedLoginAttributePath:   "new-login-attr-path",
			expectedIdTokenAttributeName: "new-id-token-attr-name",
			expectedNameAttributePath:    "new-name-attr-path",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewGenericOAuthProvider(tc.info, setting.NewCfg(), &ssosettingstests.MockService{}, featuremgmt.WithFeatures())

			err := s.Reload(context.Background(), tc.settings)
			require.NoError(t, err)

			require.EqualValues(t, tc.expectedInfo, s.info)

			require.EqualValues(t, tc.expectedTeamsUrl, s.teamsUrl)
			require.EqualValues(t, tc.expectedEmailAttributeName, s.emailAttributeName)
			require.EqualValues(t, tc.expectedEmailAttributePath, s.emailAttributePath)
			require.EqualValues(t, tc.expectedGroupsAttributePath, s.groupsAttributePath)
			require.EqualValues(t, tc.expectedTeamIdsAttributePath, s.teamIdsAttributePath)
			require.EqualValues(t, tc.expectedTeamIds, s.teamIds)
			require.EqualValues(t, tc.expectedAllowedOrganizations, s.allowedOrganizations)
			require.EqualValues(t, tc.expectedLoginAttributePath, s.loginAttributePath)
			require.EqualValues(t, tc.expectedIdTokenAttributeName, s.idTokenAttributeName)
			require.EqualValues(t, tc.expectedNameAttributePath, s.nameAttributePath)
		})
	}
}
