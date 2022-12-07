package api

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets/fakes"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func setupOAuthTest(t *testing.T, cfg *setting.Cfg) *web.Mux {
	t.Helper()

	if cfg == nil {
		cfg = setting.NewCfg()
	}
	cfg.ErrTemplateName = "error-template"
	cfg.IsFeatureToggleEnabled = func(key string) bool { return false }

	sqlStore := sqlstore.InitTestDB(t)

	hs := &HTTPServer{
		Cfg:            cfg,
		License:        &licensing.OSSLicensingService{Cfg: cfg},
		SQLStore:       sqlStore,
		SocialService:  social.ProvideService(cfg),
		HooksService:   hooks.ProvideService(),
		SecretsService: fakes.NewFakeSecretsService(),
	}

	m := web.New()
	m.Use(getContextHandler(t, cfg).Middleware)
	viewPath, err := filepath.Abs("../../public/views")
	require.NoError(t, err)

	m.UseMiddleware(web.Renderer(viewPath, "[[", "]]"))

	m.Get("/login/:name", hs.OAuthLogin)
	return m
}

func TestOAuthLogin_UnknownProvider(t *testing.T) {
	m := setupOAuthTest(t, nil)
	req := httptest.NewRequest(http.MethodGet, "/login/notaprovider", nil)
	recorder := httptest.NewRecorder()

	m.ServeHTTP(recorder, req)
	// expect to be redirected to /login
	assert.Equal(t, http.StatusFound, recorder.Code)
	assert.Equal(t, "/login", recorder.Header().Get("Location"))
}

func TestOAuthLogin_Base(t *testing.T) {
	cfg := setting.NewCfg()
	sec := cfg.Raw.Section("auth.generic_oauth")
	_, err := sec.NewKey("enabled", "true")
	require.NoError(t, err)

	m := setupOAuthTest(t, cfg)
	req := httptest.NewRequest(http.MethodGet, "/login/generic_oauth", nil)
	recorder := httptest.NewRecorder()

	m.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusFound, recorder.Code)

	location := recorder.Header().Get("Location")
	assert.NotEmpty(t, location)

	u, err := url.Parse(location)
	require.NoError(t, err)
	assert.False(t, u.Query().Has("code_challenge"))
	assert.False(t, u.Query().Has("code_challenge_method"))

	resp := recorder.Result()
	require.NoError(t, resp.Body.Close())

	cookies := resp.Cookies()
	var stateCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == OauthStateCookieName {
			stateCookie = c
		}
	}
	require.NotNil(t, stateCookie)

	req = httptest.NewRequest(
		http.MethodGet,
		(&url.URL{
			Path: "/login/generic_oauth",
			RawQuery: url.Values{
				"code":  []string{"helloworld"},
				"state": []string{u.Query().Get("state")},
			}.Encode(),
		}).String(),
		nil,
	)
	req.AddCookie(stateCookie)
	recorder = httptest.NewRecorder()

	m.ServeHTTP(recorder, req)
	// TODO: validate that 'creating a token works'
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "login.OAuthLogin(NewTransportWithCode)")
}

func TestOAuthLogin_UsePKCE(t *testing.T) {
	cfg := setting.NewCfg()
	sec := cfg.Raw.Section("auth.generic_oauth")
	_, err := sec.NewKey("enabled", "true")
	require.NoError(t, err)
	_, err = sec.NewKey("use_pkce", "true")
	require.NoError(t, err)

	m := setupOAuthTest(t, cfg)
	req := httptest.NewRequest(http.MethodGet, "/login/generic_oauth", nil)
	recorder := httptest.NewRecorder()

	m.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusFound, recorder.Code)

	location := recorder.Header().Get("Location")
	assert.NotEmpty(t, location)

	u, err := url.Parse(location)
	require.NoError(t, err)
	assert.True(t, u.Query().Has("code_challenge"))
	assert.Equal(t, "S256", u.Query().Get("code_challenge_method"))

	resp := recorder.Result()
	require.NoError(t, resp.Body.Close())

	var oauthCookie *http.Cookie
	for _, cookie := range resp.Cookies() {
		if cookie.Name == OauthPKCECookieName {
			oauthCookie = cookie
		}
	}
	require.NotNil(t, oauthCookie)

	shasum := sha256.Sum256([]byte(oauthCookie.Value))
	assert.Equal(
		t,
		u.Query().Get("code_challenge"),
		base64.RawURLEncoding.EncodeToString(shasum[:]),
	)
}
