package social

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/inconshreveable/log15"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
)

func TestSearchJSONForEmail(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.New("generic_oauth_test"),
			},
		}

		tests := []struct {
			Name                 string
			UserInfoJSONResponse []byte
			EmailAttributePath   string
			ExpectedResult       string
			ExpectedError        string
		}{
			{
				Name:                 "Given an invalid user info JSON response",
				UserInfoJSONResponse: []byte("{"),
				EmailAttributePath:   "attributes.email",
				ExpectedResult:       "",
				ExpectedError:        "failed to unmarshal user info JSON response: unexpected end of JSON input",
			},
			{
				Name:                 "Given an empty user info JSON response and empty JMES path",
				UserInfoJSONResponse: []byte{},
				EmailAttributePath:   "",
				ExpectedResult:       "",
				ExpectedError:        "no attribute path specified",
			},
			{
				Name:                 "Given an empty user info JSON response and valid JMES path",
				UserInfoJSONResponse: []byte{},
				EmailAttributePath:   "attributes.email",
				ExpectedResult:       "",
				ExpectedError:        "empty user info JSON response provided",
			},
			{
				Name: "Given a simple user info JSON response and valid JMES path",
				UserInfoJSONResponse: []byte(`{
	"attributes": {
		"email": "grafana@localhost"
	}
}`),
				EmailAttributePath: "attributes.email",
				ExpectedResult:     "grafana@localhost",
			},
			{
				Name: "Given a user info JSON response with e-mails array and valid JMES path",
				UserInfoJSONResponse: []byte(`{
	"attributes": {
		"emails": ["grafana@localhost", "admin@localhost"]
	}
}`),
				EmailAttributePath: "attributes.emails[0]",
				ExpectedResult:     "grafana@localhost",
			},
			{
				Name: "Given a nested user info JSON response and valid JMES path",
				UserInfoJSONResponse: []byte(`{
	"identities": [
		{
			"userId": "grafana@localhost"
		},
		{
			"userId": "admin@localhost"
		}
	]
}`),
				EmailAttributePath: "identities[0].userId",
				ExpectedResult:     "grafana@localhost",
			},
		}

		for _, test := range tests {
			provider.emailAttributePath = test.EmailAttributePath
			t.Run(test.Name, func(t *testing.T) {
				actualResult, err := provider.searchJSONForAttr(test.EmailAttributePath, test.UserInfoJSONResponse)
				if test.ExpectedError == "" {
					require.NoError(t, err, "Testing case %q", test.Name)
				} else {
					require.EqualError(t, err, test.ExpectedError, "Testing case %q", test.Name)
				}
				require.Equal(t, test.ExpectedResult, actualResult)
			})
		}
	})
}

func TestSearchJSONForRole(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.New("generic_oauth_test"),
			},
		}

		tests := []struct {
			Name                 string
			UserInfoJSONResponse []byte
			RoleAttributePath    string
			ExpectedResult       string
			ExpectedError        string
		}{
			{
				Name:                 "Given an invalid user info JSON response",
				UserInfoJSONResponse: []byte("{"),
				RoleAttributePath:    "attributes.role",
				ExpectedResult:       "",
				ExpectedError:        "failed to unmarshal user info JSON response: unexpected end of JSON input",
			},
			{
				Name:                 "Given an empty user info JSON response and empty JMES path",
				UserInfoJSONResponse: []byte{},
				RoleAttributePath:    "",
				ExpectedResult:       "",
				ExpectedError:        "no attribute path specified",
			},
			{
				Name:                 "Given an empty user info JSON response and valid JMES path",
				UserInfoJSONResponse: []byte{},
				RoleAttributePath:    "attributes.role",
				ExpectedResult:       "",
				ExpectedError:        "empty user info JSON response provided",
			},
			{
				Name: "Given a simple user info JSON response and valid JMES path",
				UserInfoJSONResponse: []byte(`{
	"attributes": {
		"role": "admin"
	}
}`),
				RoleAttributePath: "attributes.role",
				ExpectedResult:    "admin",
			},
		}

		for _, test := range tests {
			provider.roleAttributePath = test.RoleAttributePath
			t.Run(test.Name, func(t *testing.T) {
				actualResult, err := provider.searchJSONForAttr(test.RoleAttributePath, test.UserInfoJSONResponse)
				if test.ExpectedError == "" {
					require.NoError(t, err, "Testing case %q", test.Name)
				} else {
					require.EqualError(t, err, test.ExpectedError, "Testing case %q", test.Name)
				}
				require.Equal(t, test.ExpectedResult, actualResult)
			})
		}
	})
}

func TestUserInfoSearchesForEmailAndRole(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.New("generic_oauth_test"),
			},
			emailAttributePath: "email",
		}

		tests := []struct {
			Name                   string
			APIURLResponse         interface{}
			OAuth2Extra            interface{}
			RoleAttributePath      string
			ExpectedEmail          string
			ExpectedOrgMemberships map[int64]models.RoleType
		}{
			{
				Name: "Given a valid id_token, a valid role path, no api response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedOrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
			},
			{
				Name: "Given a valid id_token, no role path, no api response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
				},
				RoleAttributePath: "",
				ExpectedEmail:     "john.doe@example.com",
			},
			{
				Name: "Given a valid id_token, an invalid role path, no api response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				RoleAttributePath: "invalid_path",
				ExpectedEmail:     "john.doe@example.com",
			},
			{
				Name: "Given no id_token, a valid role path, a valid api response, use api response",
				APIURLResponse: map[string]interface{}{
					"role":  "Admin",
					"email": "john.doe@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedOrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
			},
			{
				Name: "Given no id_token, no role path, a valid api response, use api response",
				APIURLResponse: map[string]interface{}{
					"email": "john.doe@example.com",
				},
				RoleAttributePath: "",
				ExpectedEmail:     "john.doe@example.com",
			},
			{
				Name: "Given no id_token, a role path, a valid api response without a role, use api response",
				APIURLResponse: map[string]interface{}{
					"email": "john.doe@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
			},
			{
				Name:              "Given no id_token, a valid role path, no api response, no data",
				RoleAttributePath: "role",
				ExpectedEmail:     "",
			},
			{
				Name: "Given a valid id_token, a valid role path, a valid api response, prefer id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				APIURLResponse: map[string]interface{}{
					"role":  "FromResponse",
					"email": "from_response@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedOrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
			},
			{
				Name: "Given a valid id_token, an invalid role path, a valid api response, prefer id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				APIURLResponse: map[string]interface{}{
					"role":  "FromResponse",
					"email": "from_response@example.com",
				},
				RoleAttributePath: "invalid_path",
				ExpectedEmail:     "john.doe@example.com",
			},
			{
				Name: "Given a valid id_token with no email, a valid role path, a valid api response with no role, merge",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4ifQ.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
				},
				APIURLResponse: map[string]interface{}{
					"email": "from_response@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "from_response@example.com",
				ExpectedOrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
			},
			{
				Name: "Given a valid id_token with no role, a valid role path, a valid api response with no email, merge",
				OAuth2Extra: map[string]interface{}{
					// { "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
				},
				APIURLResponse: map[string]interface{}{
					"role": "FromResponse",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
			},
		}

		for _, test := range tests {
			provider.roleAttributePath = test.RoleAttributePath
			t.Run(test.Name, func(t *testing.T) {
				response, err := json.Marshal(test.APIURLResponse)
				require.NoError(t, err)
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					_, err = w.Write(response)
					require.NoError(t, err)
				}))
				provider.apiUrl = ts.URL
				staticToken := oauth2.Token{
					AccessToken:  "",
					TokenType:    "",
					RefreshToken: "",
					Expiry:       time.Now(),
				}

				if test.ExpectedOrgMemberships == nil {
					test.ExpectedOrgMemberships = map[int64]models.RoleType{}
				}

				token := staticToken.WithExtra(test.OAuth2Extra)
				actualResult, err := provider.UserInfo(ts.Client(), token)
				require.NoError(t, err)
				require.Equal(t, test.ExpectedEmail, actualResult.Email)
				require.Equal(t, test.ExpectedEmail, actualResult.Login)
				require.Equal(t, test.ExpectedOrgMemberships, actualResult.OrgMemberships)
			})
		}
	})
}

func TestGenericOAuth_GroupMapping(t *testing.T) {
	var apiResponse map[string]interface{}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		response, err := json.Marshal(apiResponse)
		require.NoError(t, err)
		_, err = w.Write(response)
		require.NoError(t, err)
	}))

	t.Run("Users are mapped to organizations according to group mapping filters", func(t *testing.T) {
		groupMappings, err := readGroupMappings("testdata/full.toml")
		require.NoError(t, err)
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.NewWithLevel("generic_oauth_test", log15.LvlDebug),
			},
			apiUrl:        ts.URL,
			groupMappings: groupMappings,
		}
		staticToken := oauth2.Token{
			AccessToken:  "",
			TokenType:    "",
			RefreshToken: "",
			Expiry:       time.Now(),
		}
		token := staticToken.WithExtra(map[string]interface{}{
			"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
		})

		userInfos := []*BasicUserInfo{}
		for _, group := range []string{"admin", "editor", ""} {
			apiResponse = map[string]interface{}{}
			if group != "" {
				apiResponse["groups"] = []string{group}
			}
			userInfo, err := provider.UserInfo(ts.Client(), token)
			require.NoError(t, err)
			userInfos = append(userInfos, userInfo)
		}

		isAdmin := true
		diff := cmp.Diff([]*BasicUserInfo{
			{
				Email: "john.doe@example.com",
				Login: "john.doe@example.com",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
					2: models.ROLE_ADMIN,
				},
				IsGrafanaAdmin: &isAdmin,
			},
			{
				Email: "john.doe@example.com",
				Login: "john.doe@example.com",
				OrgMemberships: map[int64]models.RoleType{
					2: models.ROLE_EDITOR,
				},
			},
			{
				Email: "john.doe@example.com",
				Login: "john.doe@example.com",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_VIEWER,
				},
			},
		}, userInfos)
		assert.Equal(t, "", diff)
	})
}

/*
func TestSearchJSONForGroupMapping(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.New("generic_oauth_test"),
			},
		}

		grafanaAdminTrue := true
		groupMappings := []setting.OAuthGroupMapping{
			{
				Filter:         "contains(groups[*], 'admin') && 'Admin'",
				Role:           "admin",
				OrgID:          1,
				IsGrafanaAdmin: &grafanaAdminTrue,
			},
			{
				Filter: "contains(groups[*], 'editor')",
				Role:   "editor",
				OrgID:  1,
			},
			{
				Filter: "contains(groups[*], 'admin') && 'Admin' || 'Viewer'",
				OrgID:  2,
			},
		}
		roleMappings := []setting.OAuthGroupMapping{
			{
				Filter: "role",
				OrgID:  1,
			},
			{
				Role:  "viewer",
				OrgID: 2,
			},
		}

		tests := []struct {
			Name           string
			APIURLReponse  interface{}
			OAuth2Extra    interface{}
			GroupMappings  []setting.OAuthGroupMapping
			ExpectedResult []setting.OAuthGroupMapping
		}{
			{
				Name:          "Given an empty user info JSON response and empty JMES path",
				APIURLReponse: map[string]interface{}{},
				OAuth2Extra: map[string]interface{}{
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				GroupMappings:  nil,
				ExpectedResult: nil,
			},
			{
				Name:          "Given an empty user info JSON response and valid JMES path",
				APIURLReponse: map[string]interface{}{},
				OAuth2Extra: map[string]interface{}{
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				GroupMappings:  groupMappings,
				ExpectedResult: nil,
			},
			{
				Name: "Given a simple user info JSON response and simple role mapping",
				APIURLReponse: map[string]interface{}{
					"role": "Admin",
				},
				OAuth2Extra: map[string]interface{}{
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				GroupMappings: roleMappings,
				ExpectedResult: []setting.OAuthGroupMapping{
					{
						Role:  "Admin",
						OrgID: 1,
					},
					{
						Role:  "Viewer",
						OrgID: 2,
					},
				},
			},
			{
				Name: "Given a simple user info JSON response and valid group mappings for editor",
				APIURLReponse: map[string]interface{}{
					"groups": []string{"editor"},
				},
				OAuth2Extra: map[string]interface{}{
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				GroupMappings: groupMappings,
				ExpectedResult: []setting.OAuthGroupMapping{
					{
						Role:  "Editor",
						OrgID: 1,
					},
					{
						Role:  "Viewer",
						OrgID: 2,
					},
				},
			},
			{
				Name: "Given a simple user info JSON response and valid group mappings for admin",
				APIURLReponse: map[string]interface{}{
					"groups": []string{"admin"},
				},
				OAuth2Extra: map[string]interface{}{
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				GroupMappings: groupMappings,
				ExpectedResult: []setting.OAuthGroupMapping{
					{
						Role:  "Admin",
						OrgID: 1,
					},
					{
						Role:  "Admin",
						OrgID: 2,
					},
				},
			},
			{
				Name: "Given a simple user info JSON response and valid group mappings for undefined group",
				APIURLReponse: map[string]interface{}{
					"groups": []string{"dne"},
				},
				OAuth2Extra: map[string]interface{}{
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				GroupMappings: groupMappings,
				ExpectedResult: []setting.OAuthGroupMapping{
					{
						Role:  "Viewer",
						OrgID: 2,
					},
				},
			},
		}

		for _, test := range tests {
			t.Run(test.Name, func(t *testing.T) {
				provider.groupMappings = test.GroupMappings

				response, err := json.Marshal(test.APIURLReponse)
				require.NoError(t, err)
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					_, err := w.Write(response)
					require.NoError(t, err)
				}))
				provider.apiUrl = ts.URL
				staticToken := oauth2.Token{
					AccessToken:  "",
					TokenType:    "",
					RefreshToken: "",
					Expiry:       time.Now(),
				}

				token := staticToken.WithExtra(test.OAuth2Extra)
				actualResult, err := provider.UserInfo(ts.Client(), token)
				require.NoError(t, err)

				assert.Equal(t, test.ExpectedResult, actualResult.GroupMappings)
			})
		}
	})
}
*/
