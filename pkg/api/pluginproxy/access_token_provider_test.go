package pluginproxy

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	. "github.com/smartystreets/goconvey/convey"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
)

var (
	token map[string]interface{}
)

func TestAccessToken(t *testing.T) {
	Convey("Plugin with JWT token auth route", t, func() {
		pluginRoute := &plugins.AppPluginRoute{
			Path:   "pathwithjwttoken1",
			Url:    "https://api.jwt.io/some/path",
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

		templateData := templateData{
			JsonData: map[string]interface{}{
				"clientEmail": "test@test.com",
				"tokenUri":    "login.url.com/token",
			},
			SecureJsonData: map[string]string{
				"privateKey": "testkey",
			},
		}

		ds := &models.DataSource{Id: 1, Version: 2}

		Convey("should fetch token using jwt private key", func() {
			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				return &oauth2.Token{AccessToken: "abc"}, nil
			}
			provider := newAccessTokenProvider(ds, pluginRoute)
			token, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)

			So(token, ShouldEqual, "abc")
		})

		Convey("should set jwt config values", func() {
			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				So(conf.Email, ShouldEqual, "test@test.com")
				So(conf.PrivateKey, ShouldResemble, []byte("testkey"))
				So(len(conf.Scopes), ShouldEqual, 2)
				So(conf.Scopes[0], ShouldEqual, "https://www.testapi.com/auth/monitoring.read")
				So(conf.Scopes[1], ShouldEqual, "https://www.testapi.com/auth/cloudplatformprojects.readonly")
				So(conf.TokenURL, ShouldEqual, "login.url.com/token")

				return &oauth2.Token{AccessToken: "abc"}, nil
			}

			provider := newAccessTokenProvider(ds, pluginRoute)
			_, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)
		})

		Convey("should use cached token on second call", func() {
			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				return &oauth2.Token{
					AccessToken: "abc",
					Expiry:      time.Now().Add(1 * time.Minute)}, nil
			}
			provider := newAccessTokenProvider(ds, pluginRoute)
			token1, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)
			So(token1, ShouldEqual, "abc")

			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				return &oauth2.Token{AccessToken: "error: cache not used"}, nil
			}
			token2, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)
			So(token2, ShouldEqual, "abc")
		})
	})

	Convey("Plugin with token auth route", t, func() {
		apiHandler := http.NewServeMux()
		server := httptest.NewServer(apiHandler)
		defer server.Close()

		pluginRoute := &plugins.AppPluginRoute{
			Path:   "pathwithtokenauth1",
			Url:    "",
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

		templateData := templateData{
			JsonData: map[string]interface{}{
				"client_id": "my_client_id",
				"audience":  "www.example.com",
			},
			SecureJsonData: map[string]string{
				"client_secret": "my_secret",
			},
		}

		var authCalls int
		apiHandler.HandleFunc("/oauth/token", func(w http.ResponseWriter, req *http.Request) {
			err := json.NewEncoder(w).Encode(token)
			require.NoError(t, err)
			authCalls++
		})

		Convey("Should parse token, with different fields and types", func() {
			type tokenTestDescription struct {
				desc              string
				expiresIn         interface{}
				expiresOn         interface{}
				expectedExpiresOn int64
			}

			mockTimeNow(time.Now())
			defer resetTimeNow()
			provider := newAccessTokenProvider(&models.DataSource{}, pluginRoute)

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
				Convey(testCase.desc, func() {
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

					accessToken, err := provider.getAccessToken(templateData)
					So(err, ShouldBeNil)
					So(accessToken, ShouldEqual, token["access_token"])

					// getAccessToken should use internal cache
					accessToken, err = provider.getAccessToken(templateData)
					So(err, ShouldBeNil)
					So(accessToken, ShouldEqual, token["access_token"])
					So(authCalls, ShouldEqual, 1)

					tokenCache.Lock()
					v, ok := tokenCache.cache[provider.getAccessTokenCacheKey()]
					tokenCache.Unlock()

					So(ok, ShouldBeTrue)
					So(v.ExpiresOn.Unix(), ShouldEqual, testCase.expectedExpiresOn)
					So(v.AccessToken, ShouldEqual, token["access_token"])
				})
			}
		})

		Convey("Should refetch token on expire", func() {
			clearTokenCache()
			// reset the httphandler counter
			authCalls = 0

			mockTimeNow(time.Now())
			defer resetTimeNow()
			provider := newAccessTokenProvider(&models.DataSource{}, pluginRoute)

			token = map[string]interface{}{
				"access_token":  "2YotnFZFEjr1zCsicMWpAA",
				"token_type":    "3600",
				"refresh_token": "tGzv3JOkF0XG5Qx2TlKWIA",
			}
			accessToken, err := provider.getAccessToken(templateData)
			So(err, ShouldBeNil)
			So(accessToken, ShouldEqual, token["access_token"])

			mockTimeNow(timeNow().Add(3601 * time.Second))

			accessToken, err = provider.getAccessToken(templateData)
			So(err, ShouldBeNil)
			So(accessToken, ShouldEqual, token["access_token"])
			So(authCalls, ShouldEqual, 2)
		})
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
