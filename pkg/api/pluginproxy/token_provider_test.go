package pluginproxy

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

var (
	token map[string]interface{}
)

func TestAccessToken_pluginWithTokenAuthRoute(t *testing.T) {
	apiHandler := http.NewServeMux()
	server := httptest.NewServer(apiHandler)
	defer server.Close()

	pluginRoute := &plugins.Route{
		Path:   "pathwithtokenauth1",
		URL:    "",
		Method: "GET",
		TokenAuth: &plugins.JWTTokenAuth{
			Url: server.URL + "/oauth/token",
			Scopes: []string{
				"https://www.testapi.com/auth/monitoring.read",
				"https://www.testapi.com/auth/cloudplatformprojects.readonly",
			},
			Params: map[string]string{
				"grant_type":    "client_credentials",
				"client_id":     "{{.JsonData.client_id}}",
				"client_secret": "{{.SecureJsonData.client_secret}}",
				"audience":      "{{.JsonData.audience}}",
				"client_name":   "datasource_plugin",
			},
		},
	}

	authParams := &plugins.JWTTokenAuth{
		Url: server.URL + "/oauth/token",
		Scopes: []string{
			"https://www.testapi.com/auth/monitoring.read",
			"https://www.testapi.com/auth/cloudplatformprojects.readonly",
		},
		Params: map[string]string{
			"grant_type":    "client_credentials",
			"client_id":     "my_client_id",
			"client_secret": "my_secret",
			"audience":      "www.example.com",
			"client_name":   "datasource_plugin",
		},
	}

	var authCalls int
	apiHandler.HandleFunc("/oauth/token", func(w http.ResponseWriter, req *http.Request) {
		err := json.NewEncoder(w).Encode(token)
		require.NoError(t, err)
		authCalls++
	})

	t.Run("Should parse token, with different fields and types", func(t *testing.T) {
		type tokenTestDescription struct {
			desc              string
			expiresIn         interface{}
			expiresOn         interface{}
			expectedExpiresOn int64
		}

		mockTimeNow(time.Now())
		defer resetTimeNow()
		provider := newGenericAccessTokenProvider(DSInfo{}, pluginRoute, authParams)

		testCases := []tokenTestDescription{
			{
				desc:              "token with expires_in in string format",
				expiresIn:         "3600",
				expiresOn:         nil,
				expectedExpiresOn: timeNow().Unix() + 3600,
			},
			{
				desc:              "token with expires_in in int format",
				expiresIn:         3600,
				expiresOn:         nil,
				expectedExpiresOn: timeNow().Unix() + 3600,
			},
			{
				desc:              "token with expires_on in string format",
				expiresOn:         strconv.FormatInt(timeNow().Add(86*time.Minute).Unix(), 10),
				expiresIn:         nil,
				expectedExpiresOn: timeNow().Add(86 * time.Minute).Unix(),
			},
			{
				desc:              "token with expires_on in int format",
				expiresOn:         timeNow().Add(86 * time.Minute).Unix(),
				expiresIn:         nil,
				expectedExpiresOn: timeNow().Add(86 * time.Minute).Unix(),
			},
			{
				desc:              "token with both expires_on and expires_in, should prioritize expiresOn",
				expiresIn:         5200,
				expiresOn:         timeNow().Add(1 * time.Hour).Unix(),
				expectedExpiresOn: timeNow().Add(1 * time.Hour).Unix(),
			},
		}
		for _, testCase := range testCases {
			t.Run(testCase.desc, func(t *testing.T) {
				clearTokenCache()
				// reset the httphandler counter
				authCalls = 0

				token = map[string]interface{}{
					"access_token":  "2YotnFZFEjr1zCsicMWpAA",
					"token_type":    "example",
					"refresh_token": "tGzv3JOkF0XG5Qx2TlKWIA",
				}

				if testCase.expiresIn != nil {
					token["expires_in"] = testCase.expiresIn
				}

				if testCase.expiresOn != nil {
					token["expires_on"] = testCase.expiresOn
				}

				accessToken, err := provider.GetAccessToken()
				require.NoError(t, err)
				assert.Equal(t, token["access_token"], accessToken)

				// GetAccessToken should use internal cache
				accessToken, err = provider.GetAccessToken()
				require.NoError(t, err)
				assert.Equal(t, token["access_token"], accessToken)
				assert.Equal(t, 1, authCalls)

				tokenCache.Lock()
				v, ok := tokenCache.cache[provider.getAccessTokenCacheKey()]
				tokenCache.Unlock()

				assert.True(t, ok)
				assert.Equal(t, testCase.expectedExpiresOn, v.ExpiresOn.Unix())
				assert.Equal(t, token["access_token"], v.AccessToken)
			})
		}
	})

	t.Run("Should refetch token on expire", func(t *testing.T) {
		clearTokenCache()
		// reset the httphandler counter
		authCalls = 0

		mockTimeNow(time.Now())
		defer resetTimeNow()
		provider := newGenericAccessTokenProvider(DSInfo{}, pluginRoute, authParams)

		token = map[string]interface{}{
			"access_token":  "2YotnFZFEjr1zCsicMWpAA",
			"token_type":    "3600",
			"refresh_token": "tGzv3JOkF0XG5Qx2TlKWIA",
		}
		accessToken, err := provider.GetAccessToken()
		require.NoError(t, err)
		assert.Equal(t, token["access_token"], accessToken)

		mockTimeNow(timeNow().Add(3601 * time.Second))

		accessToken, err = provider.GetAccessToken()
		require.NoError(t, err)
		assert.Equal(t, token["access_token"], accessToken)
		assert.Equal(t, 2, authCalls)
	})
}

func clearTokenCache() {
	tokenCache.Lock()
	defer tokenCache.Unlock()
	tokenCache.cache = map[string]*jwtToken{}
	token = map[string]interface{}{}
}

func mockTimeNow(timeSeed time.Time) {
	timeNow = func() time.Time {
		return timeSeed
	}
}

func resetTimeNow() {
	timeNow = time.Now
}
