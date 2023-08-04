package api

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func setupSocialHTTPServerWithConfig(t *testing.T, cfg *setting.Cfg) *HTTPServer {
	sqlStore := db.InitTestDB(t)
	features := featuremgmt.WithFeatures()

	return &HTTPServer{
		Cfg:            cfg,
		License:        &licensing.OSSLicensingService{Cfg: cfg},
		SQLStore:       sqlStore,
		SocialService:  social.ProvideService(cfg, features, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService(), remotecache.NewFakeCacheStorage()),
		HooksService:   hooks.ProvideService(),
		SecretsService: fakes.NewFakeSecretsService(),
		Features:       features,
	}
}

func setupOAuthTest(t *testing.T, cfg *setting.Cfg) *web.Mux {
	t.Helper()

	if cfg == nil {
		cfg = setting.NewCfg()
	}
	cfg.ErrTemplateName = "error-template"
	hs := setupSocialHTTPServerWithConfig(t, cfg)

	m := web.New()
	m.Use(getContextHandler(t, cfg).Middleware)
	viewPath, err := filepath.Abs("../../public/views")
	require.NoError(t, err)

	m.UseMiddleware(web.Renderer(viewPath, "[[", "]]"))

	m.Get("/login/:name", hs.OAuthLogin)
	return m
}

func setClientWithoutRedirectFollow(t *testing.T) {
	t.Helper()
	old := http.DefaultClient
	http.DefaultClient = &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	t.Cleanup(func() {
		http.DefaultClient = old
	})
}

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
			setClientWithoutRedirectFollow(t)

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
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.Cfg.LoginCookieName = "grafana_session"
				hs.SecretsService = fakes.NewFakeSecretsService()
				hs.authnService = &authntest.FakeService{
					ExpectedErr:      tt.expectedErr,
					ExpectedIdentity: tt.expectedIdentity,
				}
			})

			// we need to prevent the http.Client from following redirects
			setClientWithoutRedirectFollow(t)

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
				assert.Equal(t, "grafana_session", res.Cookies()[2].Name)
				assert.Equal(t, "grafana_session_expiry", res.Cookies()[3].Name)
			}
		})
	}
}

func TestOAuthLogin_Error(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.SecretsService = fakes.NewFakeSecretsService()
	})

	setClientWithoutRedirectFollow(t)

	res, err := server.Send(server.NewGetRequest(fmt.Sprintf("/login/azuread?error=someerror")))
	require.NoError(t, err)

	assert.Equal(t, http.StatusFound, res.StatusCode)
	assert.Equal(t, "/login", res.Header.Get("Location"))

	require.Len(t, res.Cookies(), 1)
	errCookie := res.Cookies()[0]
	assert.Equal(t, loginErrorCookieName, errCookie.Name)
}
