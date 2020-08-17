package social

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/inconshreveable/log15"
	"github.com/stretchr/testify/require"

	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"golang.org/x/oauth2"
)

func TestSearchJSONForEmail(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.NewWithLevel("generic_oauth_test", log15.LvlDebug),
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
				log: log.NewWithLevel("generic_oauth_test", log15.LvlDebug),
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
				log: log.NewWithLevel("generic_oauth_test", log15.LvlDebug),
			},
			emailAttributePath: "email",
		}

		tests := []struct {
			Name              string
			ResponseBody      interface{}
			OAuth2Extra       interface{}
			RoleAttributePath string
			ExpectedEmail     string
			ExpectedRole      string
		}{
			{
				Name: "Given a valid id_token, a valid role path, no API response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "Admin",
			},
			{
				Name: "Given a valid id_token, no role path, no API response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
				},
				RoleAttributePath: "",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "",
			},
			{
				Name: "Given a valid id_token, an invalid role path, no API response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				RoleAttributePath: "invalid_path",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "",
			},
			{
				Name: "Given no id_token, a valid role path, a valid API response, use API response",
				ResponseBody: map[string]interface{}{
					"role":  "Admin",
					"email": "john.doe@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "Admin",
			},
			{
				Name: "Given no id_token, no role path, a valid API response, use API response",
				ResponseBody: map[string]interface{}{
					"email": "john.doe@example.com",
				},
				RoleAttributePath: "",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "",
			},
			{
				Name: "Given no id_token, a role path, a valid API response without a role, use API response",
				ResponseBody: map[string]interface{}{
					"email": "john.doe@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "",
			},
			{
				Name:              "Given no id_token, a valid role path, no API response, no data",
				RoleAttributePath: "role",
				ExpectedEmail:     "",
				ExpectedRole:      "",
			},
			{
				Name: "Given a valid id_token, a valid role path, a valid API response, prefer id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				ResponseBody: map[string]interface{}{
					"role":  "FromResponse",
					"email": "from_response@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "Admin",
			},
			{
				Name: "Given a valid id_token, an invalid role path, a valid API response, prefer id_token",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.9PtHcCaXxZa2HDlASyKIaFGfOKlw2ILQo32xlvhvhRg",
				},
				ResponseBody: map[string]interface{}{
					"role":  "FromResponse",
					"email": "from_response@example.com",
				},
				RoleAttributePath: "invalid_path",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "",
			},
			{
				Name: "Given a valid id_token with no email, a valid role path, a valid API response with no role, merge",
				OAuth2Extra: map[string]interface{}{
					// { "role": "Admin" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4ifQ.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
				},
				ResponseBody: map[string]interface{}{
					"email": "from_response@example.com",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "from_response@example.com",
				ExpectedRole:      "Admin",
			},
			{
				Name: "Given a valid id_token with no role, a valid role path, a valid API response with no email, merge",
				OAuth2Extra: map[string]interface{}{
					// { "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.k5GwPcZvGe2BE_jgwN0ntz0nz4KlYhEd0hRRLApkTJ4",
				},
				ResponseBody: map[string]interface{}{
					"role": "FromResponse",
				},
				RoleAttributePath: "role",
				ExpectedEmail:     "john.doe@example.com",
				ExpectedRole:      "FromResponse",
			},
		}

		for _, test := range tests {
			provider.roleAttributePath = test.RoleAttributePath
			t.Run(test.Name, func(t *testing.T) {
				body, err := json.Marshal(test.ResponseBody)
				require.NoError(t, err)
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					_, err = w.Write(body)
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
				require.Equal(t, test.ExpectedEmail, actualResult.Email)
				require.Equal(t, test.ExpectedEmail, actualResult.Login)
				require.Equal(t, test.ExpectedRole, actualResult.Role)
			})
		}
	})
}

func TestUserInfoSearchesForLogin(t *testing.T) {
	t.Run("Given a generic OAuth provider", func(t *testing.T) {
		provider := SocialGenericOAuth{
			SocialBase: &SocialBase{
				log: log.NewWithLevel("generic_oauth_test", log15.LvlDebug),
			},
			loginAttributePath: "login",
		}

		tests := []struct {
			Name               string
			ResponseBody       interface{}
			OAuth2Extra        interface{}
			LoginAttributePath string
			ExpectedLogin      string
		}{
			{
				Name: "Given a valid id_token, a valid login path, no API response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "login": "johndoe", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6ImpvaG5kb2UiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.sg4sRJCNpax_76XMgr277fdxhjjtNSWXKIOFv4_GJN8",
				},
				LoginAttributePath: "role",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given a valid id_token, no login path, no API response, use id_token",
				OAuth2Extra: map[string]interface{}{
					// { "login": "johndoe", "email": "john.doe@example.com" }
					"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6ImpvaG5kb2UiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIn0.sg4sRJCNpax_76XMgr277fdxhjjtNSWXKIOFv4_GJN8",
				},
				LoginAttributePath: "",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given no id_token, a valid login path, a valid API response, use API response",
				ResponseBody: map[string]interface{}{
					"user_uid": "johndoe",
					"email":    "john.doe@example.com",
				},
				LoginAttributePath: "user_uid",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given no id_token, no login path, a valid API response, use API response",
				ResponseBody: map[string]interface{}{
					"login": "johndoe",
				},
				LoginAttributePath: "",
				ExpectedLogin:      "johndoe",
			},
			{
				Name: "Given no id_token, a login path, a valid API response without a login, use API response",
				ResponseBody: map[string]interface{}{
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
				require.Equal(t, test.ExpectedLogin, actualResult.Login)
			})
		}
	})
}

func TestPayloadCompression(t *testing.T) {
	provider := SocialGenericOAuth{
		SocialBase: &SocialBase{
			log: log.NewWithLevel("generic_oauth_test", log15.LvlDebug),
		},
		emailAttributePath: "email",
	}

	tests := []struct {
		Name          string
		OAuth2Extra   interface{}
		ExpectedEmail string
	}{
		{
			Name: "Given a valid DEFLATE compressed id_token, return userInfo",
			OAuth2Extra: map[string]interface{}{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInppcCI6IkRFRiJ9.eJyrVkrNTczMUbJSysrPyNNLyU91SK1IzC3ISdVLzs9V0lEqys9JBco6puRm5inVAgCFRw_6.XrV4ZKhw19dTcnviXanBD8lwjeALCYtDiESMmGzC-ho",
			},
			ExpectedEmail: "john.doe@example.com",
		},
		{
			Name: "Given an invalid DEFLATE compressed id_token, return nil",
			OAuth2Extra: map[string]interface{}{
				// { "role": "Admin", "email": "john.doe@example.com" }
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInppcCI6IkRFRiJ9.00eJyrVkrNTczMUbJSysrPyNNLyU91SK1IzC3ISdVLzs9V0lEqys9JBco6puRm5inVAgCFRw_6.XrV4ZKhw19dTcnviXanBD8lwjeALCYtDiESMmGzC-ho",
			},
			ExpectedEmail: "",
		},
		{
			Name: "Given an unsupported GZIP compressed id_token, return nil",
			OAuth2Extra: map[string]interface{}{
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
