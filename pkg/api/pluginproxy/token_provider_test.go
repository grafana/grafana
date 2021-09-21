package pluginproxy

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
)

var (
	token map[string]interface{}
)

func TestAccessToken_pluginWithJWTTokenAuthRoute(t *testing.T) {
	pluginRoute := &plugins.AppPluginRoute{
		Path:   "pathwithjwttoken1",
		URL:    "https://api.jwt.io/some/path",
		Method: "GET",
		JwtTokenAuth: &plugins.JwtTokenAuth{
			Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
			Scopes: []string{
				"https://www.testapi.com/auth/monitoring.read",
				"https://www.testapi.com/auth/cloudplatformprojects.readonly",
			},
			Params: map[string]string{
				"token_uri":    "{{.JsonData.tokenUri}}",
				"client_email": "{{.JsonData.clientEmail}}",
				"private_key":  "{{.SecureJsonData.privateKey}}",
			},
		},
	}

	authParams := &plugins.JwtTokenAuth{
		Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
		Scopes: []string{
			"https://www.testapi.com/auth/monitoring.read",
			"https://www.testapi.com/auth/cloudplatformprojects.readonly",
		},
		Params: map[string]string{
			"token_uri":    "login.url.com/token",
			"client_email": "test@test.com",
			"private_key":  "testkey",
		},
	}

	setUp := func(t *testing.T, fn func(*jwt.Config, context.Context) (*oauth2.Token, error)) {
		origFn := getTokenSource
		t.Cleanup(func() {
			getTokenSource = origFn
		})

		getTokenSource = fn
	}

	ds := &models.DataSource{Id: 1, Version: 2}

	t.Run("should fetch token using JWT private key", func(t *testing.T) {
		setUp(t, func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
			return &oauth2.Token{AccessToken: "abc"}, nil
		})
		provider := newJwtAccessTokenProvider(context.Background(), ds, pluginRoute, authParams)
		token, err := provider.GetAccessToken()
		require.NoError(t, err)

		assert.Equal(t, "abc", token)
	})

	t.Run("should set JWT config values", func(t *testing.T) {
		setUp(t, func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
			assert.Equal(t, "test@test.com", conf.Email)
			assert.Equal(t, []byte("testkey"), conf.PrivateKey)
			assert.Equal(t, 2, len(conf.Scopes))
			assert.Equal(t, "https://www.testapi.com/auth/monitoring.read", conf.Scopes[0])
			assert.Equal(t, "https://www.testapi.com/auth/cloudplatformprojects.readonly", conf.Scopes[1])
			assert.Equal(t, "login.url.com/token", conf.TokenURL)

			return &oauth2.Token{AccessToken: "abc"}, nil
		})

		provider := newJwtAccessTokenProvider(context.Background(), ds, pluginRoute, authParams)
		_, err := provider.GetAccessToken()
		require.NoError(t, err)
	})

	t.Run("should use cached token on second call", func(t *testing.T) {
		setUp(t, func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
			return &oauth2.Token{
				AccessToken: "abc",
				Expiry:      time.Now().Add(1 * time.Minute)}, nil
		})
		provider := newJwtAccessTokenProvider(context.Background(), ds, pluginRoute, authParams)
		token1, err := provider.GetAccessToken()
		require.NoError(t, err)
		assert.Equal(t, "abc", token1)

		getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
			return &oauth2.Token{AccessToken: "error: cache not used"}, nil
		}
		token2, err := provider.GetAccessToken()
		require.NoError(t, err)
		assert.Equal(t, "abc", token2)
	})
}

func TestAccessToken_pluginWithTokenAuthRoute(t *testing.T) {
	apiHandler := http.NewServeMux()
	server := httptest.NewServer(apiHandler)
	defer server.Close()

	pluginRoute := &plugins.AppPluginRoute{
		Path:   "pathwithtokenauth1",
		URL:    "",
		Method: "GET",
		TokenAuth: &plugins.JwtTokenAuth{
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

	authParams := &plugins.JwtTokenAuth{
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
		provider := newGenericAccessTokenProvider(&models.DataSource{}, pluginRoute, authParams)

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
		provider := newGenericAccessTokenProvider(&models.DataSource{}, pluginRoute, authParams)

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
