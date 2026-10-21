package pluginproxy

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	datasourcesV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
)

var (
	token map[string]any
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
			expiresIn         any
			expiresOn         any
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

				token = map[string]any{
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

		token = map[string]any{
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

func TestAccessToken_datasourceIsolation(t *testing.T) {
	for _, tc := range []struct {
		name       string
		namespaces [2]string
		uids       [2]string
		types      [2]string
	}{
		{
			name:       "same UID in different tenants",
			namespaces: [2]string{"stacks-1", "stacks-2"},
			uids:       [2]string{"datasource", "datasource"},
			types:      [2]string{"plugin-a", "plugin-a"},
		},
		{
			name:       "different UIDs in the same tenant without legacy IDs",
			namespaces: [2]string{"stacks-1", "stacks-1"},
			uids:       [2]string{"datasource-a", "datasource-b"},
			types:      [2]string{"plugin-a", "plugin-a"},
		},
		{
			name:       "same UID in the same tenant with different datasource types",
			namespaces: [2]string{"stacks-1", "stacks-1"},
			uids:       [2]string{"datasource", "datasource"},
			types:      [2]string{"plugin-a", "plugin-b"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			clearTokenCache()
			t.Cleanup(clearTokenCache)

			var authCalls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				authCalls.Add(1)
				if err := req.ParseForm(); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				assert.NoError(t, json.NewEncoder(w).Encode(map[string]any{
					"access_token": req.Form.Get("client_secret") + "-token",
					"expires_in":   3600,
				}))
			}))
			t.Cleanup(server.Close)

			route := &plugins.Route{
				Path:   "query",
				Method: http.MethodGet,
				TokenAuth: &plugins.JWTTokenAuth{
					Url: server.URL,
					Params: map[string]string{
						"client_secret": "{{.SecureJsonData.client_secret}}",
					},
				},
			}
			updated := metav1.NewTime(time.Unix(1700000000, 0))
			// Alternate datasources to check both isolation and reuse across requests.
			for _, i := range []int{0, 1, 0, 1} {
				ds := &datasourcesV0.DataSource{
					ObjectMeta: metav1.ObjectMeta{
						Namespace:         tc.namespaces[i],
						Name:              tc.uids[i],
						CreationTimestamp: updated,
					},
					Spec: datasourcesV0.UnstructuredSpec{},
				}
				secret := "secret-" + strconv.Itoa(i)
				req := httptest.NewRequest(http.MethodGet, "http://datasource/query", nil)
				ApplyRoute(context.Background(), req, "query", route,
					dsInfo(ds, tc.types[i], map[string]string{"client_secret": secret}), &DataSourceProxySettings{})
				require.Equal(t, "Bearer "+secret+"-token", req.Header.Get("Authorization"))
			}
			require.EqualValues(t, 2, authCalls.Load())
		})
	}
}

func clearTokenCache() {
	tokenCache.Lock()
	defer tokenCache.Unlock()
	tokenCache.cache = map[string]*jwtToken{}
	token = map[string]any{}
}

func mockTimeNow(timeSeed time.Time) {
	timeNow = func() time.Time {
		return timeSeed
	}
}

func resetTimeNow() {
	timeNow = time.Now
}
