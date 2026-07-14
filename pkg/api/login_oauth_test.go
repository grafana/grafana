package api

import (
	"errors"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOAuthLogin_Redirect(t *testing.T) {
	type testCase struct {
		desc             string
		expectedErr      error
		expectedCode     int
		expectedRedirect *authn.Redirect
	}

	tests := []testCase{
		{
			desc:         "should be redirected to /login when passing un-configured provider",
			expectedErr:  authn.ErrClientNotConfigured,
			expectedCode: http.StatusFound,
		},
		{
			desc:         "should be redirected to provider",
			expectedCode: http.StatusFound,
			expectedRedirect: &authn.Redirect{
				URL: "https://some-provider.com",
				Extra: map[string]string{
					authn.KeyOAuthState: "some-state",
				},
			},
		},
		{
			desc:         "should set pkce cookie",
			expectedCode: http.StatusFound,
			expectedRedirect: &authn.Redirect{
				URL: "https://some-provider.com",
				Extra: map[string]string{
					authn.KeyOAuthState: "some-state",
					authn.KeyOAuthPKCE:  "pkce-",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.SecretsService = fakes.NewFakeSecretsService()
				hs.authnService = &authntest.FakeService{
					ExpectedErr:      tt.expectedErr,
					ExpectedRedirect: tt.expectedRedirect,
				}
			})

			// we need to prevent the http.Client from following redirects
			server.HttpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}

			res, err := server.Send(server.NewGetRequest("/login/generic_oauth"))
			require.NoError(t, err)

			assert.Equal(t, http.StatusFound, res.StatusCode)

			// on every error we should get redirected to /login
			if tt.expectedErr != nil {
				assert.Equal(t, "/login", res.Header.Get("Location"))
			} else {
				// check that we get correct redirect url
				assert.Equal(t, tt.expectedRedirect.URL, res.Header.Get("Location"))

				require.GreaterOrEqual(t, len(res.Cookies()), 1)
				if tt.expectedRedirect.Extra[authn.KeyOAuthPKCE] != "" {
					require.Len(t, res.Cookies(), 2)
				} else {
					require.Len(t, res.Cookies(), 1)
				}

				require.GreaterOrEqual(t, len(res.Cookies()), 1)
				stateCookie := res.Cookies()[0]
				assert.Equal(t, OauthStateCookieName, stateCookie.Name)
				assert.Equal(t, tt.expectedRedirect.Extra[authn.KeyOAuthState], stateCookie.Value)

				if tt.expectedRedirect.Extra[authn.KeyOAuthPKCE] != "" {
					require.Len(t, res.Cookies(), 2)
					pkceCookie := res.Cookies()[1]
					assert.Equal(t, OauthPKCECookieName, pkceCookie.Name)
					assert.Equal(t, tt.expectedRedirect.Extra[authn.KeyOAuthPKCE], pkceCookie.Value)
				} else {
					require.Len(t, res.Cookies(), 1)
				}

				require.NoError(t, res.Body.Close())
			}
		})
	}
}

func TestOAuthLogin_AuthorizationCode(t *testing.T) {
	type testCase struct {
		desc             string
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:        "should redirect to /login on error",
			expectedErr: errors.New("some error"),
		},
		{
			desc: "should redirect to / and set session cookie on successful authentication",
			expectedIdentity: &authn.Identity{
				SessionToken: &usertoken.UserToken{UnhashedToken: "some-token"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var cfg *setting.Cfg
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				cfg = setting.NewCfg()
				hs.Cfg = cfg
				hs.Cfg.LoginCookieName = "some_name"
				hs.SecretsService = fakes.NewFakeSecretsService()
				hs.authnService = &authntest.FakeService{
					ExpectedErr:      tt.expectedErr,
					ExpectedIdentity: tt.expectedIdentity,
				}
			})

			// we need to prevent the http.Client from following redirects
			server.HttpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}

			res, err := server.Send(server.NewGetRequest("/login/generic_oauth?code=code"))
			require.NoError(t, err)

			require.GreaterOrEqual(t, len(res.Cookies()), 3)

			// make sure oauth state cookie is deleted
			assert.Equal(t, OauthStateCookieName, res.Cookies()[0].Name)
			assert.Equal(t, "", res.Cookies()[0].Value)
			assert.Equal(t, -1, res.Cookies()[0].MaxAge)

			// make sure oauth pkce cookie is deleted
			assert.Equal(t, OauthPKCECookieName, res.Cookies()[1].Name)
			assert.Equal(t, "", res.Cookies()[1].Value)
			assert.Equal(t, -1, res.Cookies()[1].MaxAge)

			if tt.expectedErr != nil {
				require.Len(t, res.Cookies(), 3)
				assert.Equal(t, http.StatusFound, res.StatusCode)
				assert.Equal(t, "/login", res.Header.Get("Location"))
				assert.Equal(t, loginErrorCookieName, res.Cookies()[2].Name)
			} else {
				require.Len(t, res.Cookies(), 4)
				assert.Equal(t, http.StatusFound, res.StatusCode)
				assert.Equal(t, "/", res.Header.Get("Location"))

				// verify session expiry cookie is set
				assert.Equal(t, cfg.LoginCookieName, res.Cookies()[2].Name)
				assert.Equal(t, "grafana_session_expiry", res.Cookies()[3].Name)
			}

			require.NoError(t, res.Body.Close())
		})
	}
}

func TestOAuthLogin_Error(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.log = log.NewNopLogger()
		hs.SecretsService = fakes.NewFakeSecretsService()
	})
	server.HttpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}

	res, err := server.Send(server.NewGetRequest("/login/azuread?error=someerror"))
	require.NoError(t, err)

	assert.Equal(t, http.StatusFound, res.StatusCode)
	assert.Equal(t, "/login", res.Header.Get("Location"))

	require.Len(t, res.Cookies(), 1)
	errCookie := res.Cookies()[0]
	assert.Equal(t, loginErrorCookieName, errCookie.Name)
	require.NoError(t, res.Body.Close())
}

func TestOAuthLogin_RedirectToCookiePreservesEncodedCharacters(t *testing.T) {
	// Go's net/http silently strips characters like " from cookie values
	// because they are not valid per RFC 6265. OAuthLogin must URL-encode
	// the redirectTo value before writing it to the cookie so that characters
	// like " survive as %22, matching the url.QueryUnescape on the read side
	// in handleLogin.

	redirectTos := []string{
		"/some/path",
		"/some/path?flag=true&id=abc123",
		`/some/path?query=metric{label="value"}`,
		`/some/path?flag=true&query=up{instance="localhost:9090"}&dashboard=d402d94e`,
	}

	for _, redirectTo := range redirectTos {
		t.Run(redirectTo, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.SecretsService = fakes.NewFakeSecretsService()
				hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagUseSessionStorageForRedirection)
				hs.authnService = &authntest.FakeService{
					ExpectedRedirect: &authn.Redirect{
						URL: "https://oauth-provider.example.com/authorize",
						Extra: map[string]string{
							authn.KeyOAuthState: "test-state",
						},
					},
				}
			})

			server.HttpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}

			res, err := server.Send(server.NewGetRequest(
				"/login/generic_oauth?redirectTo=" + url.QueryEscape(redirectTo),
			))
			require.NoError(t, err)
			defer func() { require.NoError(t, res.Body.Close()) }()

			assert.Equal(t, http.StatusFound, res.StatusCode)

			var redirectToCookie *http.Cookie
			for _, c := range res.Cookies() {
				if c.Name == "redirectTo" {
					redirectToCookie = c
					break
				}
			}
			require.NotNil(t, redirectToCookie, "OAuthLogin should write a redirectTo cookie")

			decoded, err := url.QueryUnescape(redirectToCookie.Value)
			require.NoError(t, err)
			assert.Equal(t, redirectTo, decoded,
				"redirectTo cookie should round-trip through QueryUnescape to the original value")
		})
	}
}
