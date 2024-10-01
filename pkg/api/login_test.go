package api

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	loginservice "github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const loginCookieName = "grafana_session"

func fakeSetIndexViewData(t *testing.T) {
	origSetIndexViewData := setIndexViewData
	t.Cleanup(func() {
		setIndexViewData = origSetIndexViewData
	})
	setIndexViewData = func(*HTTPServer, *contextmodel.ReqContext) (*dtos.IndexViewData, error) {
		data := &dtos.IndexViewData{
			User:     &dtos.CurrentUser{},
			Settings: &dtos.FrontendSettingsDTO{},
			NavTree:  &navtree.NavTreeRoot{},
			Assets: &dtos.EntryPointAssets{
				JSFiles: []dtos.EntryPointAsset{},
				Dark:    "dark.css",
				Light:   "light.css",
			},
		}
		return data, nil
	}
}

func fakeViewIndex(t *testing.T) {
	origGetViewIndex := getViewIndex
	t.Cleanup(func() {
		getViewIndex = origGetViewIndex
	})
	getViewIndex = func() string {
		return "index"
	}
}

func getBody(resp *httptest.ResponseRecorder) (string, error) {
	responseData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(responseData), nil
}

type redirectCase struct {
	desc        string
	url         string
	status      int
	appURL      string
	appSubURL   string
	redirectURL string
}

var oAuthInfos = map[string]*social.OAuthInfo{
	"github": {
		ClientId:     "fake",
		ClientSecret: "fakefake",
		Enabled:      true,
		AllowSignup:  true,
		Name:         "github",
	},
}

func TestLoginErrorCookieAPIEndpoint(t *testing.T) {
	fakeSetIndexViewData(t)

	fakeViewIndex(t)

	sc := setupScenarioContext(t, "/login")
	cfg := setting.NewCfg()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	hs := &HTTPServer{
		Cfg:              cfg,
		SettingsProvider: &setting.OSSImpl{Cfg: cfg},
		License:          &licensing.OSSLicensingService{},
		SocialService:    &mockSocialService{},
		SecretsService:   secretsService,
		Features:         featuremgmt.WithFeatures(),
	}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	cfg.LoginCookieName = loginCookieName
	cfg.OAuthAutoLogin = true

	oauthError := errors.New("User not a member of one of the required organizations")
	encryptedError, err := hs.SecretsService.Encrypt(context.Background(), []byte(oauthError.Error()), secrets.WithoutScope())
	require.NoError(t, err)
	expCookiePath := "/"
	if len(cfg.AppSubURL) > 0 {
		expCookiePath = cfg.AppSubURL
	}
	cookie := http.Cookie{
		Name:     loginErrorCookieName,
		MaxAge:   60,
		Value:    hex.EncodeToString(encryptedError),
		HttpOnly: true,
		Path:     expCookiePath,
		Secure:   hs.Cfg.CookieSecure,
		SameSite: hs.Cfg.CookieSameSiteMode,
	}
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertionsWithCookie("GET", sc.url, cookie).exec()
	require.Equal(t, 200, sc.resp.Code)

	responseString, err := getBody(sc.resp)
	require.NoError(t, err)
	assert.True(t, strings.Contains(responseString, oauthError.Error()))
}

func TestLoginViewRedirect(t *testing.T) {
	fakeSetIndexViewData(t)
	fakeViewIndex(t)
	sc := setupScenarioContext(t, "/login")
	cfg := setting.NewCfg()
	hs := &HTTPServer{
		Cfg:              cfg,
		SettingsProvider: &setting.OSSImpl{Cfg: cfg},
		License:          &licensing.OSSLicensingService{},
		SocialService:    &mockSocialService{},
		Features:         featuremgmt.WithFeatures(),
		log:              log.NewNopLogger(),
	}
	hs.Cfg.CookieSecure = true

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.IsSignedIn = true
		c.SignedInUser = &user.SignedInUser{
			UserID: 10,
		}
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	redirectCases := []redirectCase{
		{
			desc:        "grafana relative url without subpath",
			url:         "/profile",
			redirectURL: "/profile",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "grafana invalid relative url starting with the subpath",
			url:         "/grafanablah",
			redirectURL: "/grafana/",
			appURL:      "http://localhost:3000/",
			appSubURL:   "/grafana",
			status:      302,
		},
		{
			desc:        "grafana relative url with subpath with leading slash",
			url:         "/grafana/profile",
			redirectURL: "/grafana/profile",
			appURL:      "http://localhost:3000",
			appSubURL:   "/grafana",
			status:      302,
		},
		{
			desc:        "relative url with missing subpath",
			url:         "/profile",
			redirectURL: "/grafana/",
			appURL:      "http://localhost:3000/",
			appSubURL:   "/grafana",
			status:      302,
		},
		{
			desc:        "grafana absolute url",
			url:         "http://localhost:3000/profile",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "non grafana absolute url",
			url:         "http://example.com",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "invalid url",
			url:         ":foo",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "non-Grafana URL without scheme",
			url:         "example.com",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "non-Grafana URL without scheme",
			url:         "www.example.com",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "URL path is a host with two leading slashes",
			url:         "//example.com",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "URL path is a host with three leading slashes",
			url:         "///example.com",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "URL path is an IP address with two leading slashes",
			url:         "//0.0.0.0",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
		{
			desc:        "URL path is an IP address with three leading slashes",
			url:         "///0.0.0.0",
			redirectURL: "/",
			appURL:      "http://localhost:3000/",
			status:      302,
		},
	}

	for _, c := range redirectCases {
		hs.Cfg.AppURL = c.appURL
		hs.Cfg.AppSubURL = c.appSubURL
		t.Run(c.desc, func(t *testing.T) {
			expCookiePath := "/"
			if len(hs.Cfg.AppSubURL) > 0 {
				expCookiePath = hs.Cfg.AppSubURL
			}
			cookie := http.Cookie{
				Name:     "redirect_to",
				MaxAge:   60,
				Value:    c.url,
				HttpOnly: true,
				Path:     expCookiePath,
				Secure:   hs.Cfg.CookieSecure,
				SameSite: hs.Cfg.CookieSameSiteMode,
			}
			sc.m.Get(sc.url, sc.defaultHandler)
			sc.fakeReqNoAssertionsWithCookie("GET", sc.url, cookie).exec()
			require.Equal(t, c.status, sc.resp.Code)
			if c.status == 302 {
				location, ok := sc.resp.Header()["Location"]
				assert.True(t, ok)
				assert.Equal(t, c.redirectURL, location[0])

				setCookie, ok := sc.resp.Header()["Set-Cookie"]
				assert.True(t, ok, "Set-Cookie exists")
				assert.Greater(t, len(setCookie), 0)
				var redirectToCookieFound bool
				redirectToCookieShouldBeDeleted := c.url != c.redirectURL
				expCookieValue := c.redirectURL
				expCookieMaxAge := 60
				if redirectToCookieShouldBeDeleted {
					expCookieValue = ""
					expCookieMaxAge = 0
				}
				expCookie := fmt.Sprintf("redirect_to=%v; Path=%v; Max-Age=%v; HttpOnly; Secure", expCookieValue, expCookiePath, expCookieMaxAge)
				for _, cookieValue := range setCookie {
					if cookieValue == expCookie {
						redirectToCookieFound = true
						break
					}
				}
				assert.True(t, redirectToCookieFound)
			}
		})
	}
}

func TestLoginPostRedirect(t *testing.T) {
	fakeSetIndexViewData(t)

	fakeViewIndex(t)
	sc := setupScenarioContext(t, "/login")

	hs := &HTTPServer{
		log:          log.NewNopLogger(),
		Cfg:          setting.NewCfg(),
		HooksService: &hooks.HooksService{},
		License:      &licensing.OSSLicensingService{},
		authnService: &authntest.FakeService{
			ExpectedIdentity: &authn.Identity{ID: "42", Type: claims.TypeUser, SessionToken: &usertoken.UserToken{}},
		},
		AuthTokenService: authtest.NewFakeUserAuthTokenService(),
		Features:         featuremgmt.WithFeatures(),
	}
	hs.Cfg.CookieSecure = true

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.Header.Set("Content-Type", "application/json")
		c.Req.Body = io.NopCloser(bytes.NewBufferString(`{"user":"admin","password":"admin"}`))
		return hs.LoginPost(c)
	})

	redirectCases := []redirectCase{
		{
			desc:        "grafana relative url without subpath",
			url:         "/profile",
			redirectURL: "/profile",
			appURL:      "https://localhost:3000/",
		},
		{
			desc:        "grafana relative url with subpath with leading slash",
			url:         "/grafana/profile",
			redirectURL: "/grafana/profile",
			appURL:      "https://localhost:3000/",
			appSubURL:   "/grafana",
		},
		{
			desc:        "grafana invalid relative url starting with subpath",
			url:         "/grafanablah",
			redirectURL: "/grafana/",
			appURL:      "https://localhost:3000/",
			appSubURL:   "/grafana",
		},
		{
			desc:        "relative url with missing subpath",
			url:         "/profile",
			redirectURL: "/grafana/",
			appURL:      "https://localhost:3000/",
			appSubURL:   "/grafana",
		},
		{
			desc:        "grafana absolute url",
			url:         "http://localhost:3000/profile",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "non grafana absolute url",
			url:         "http://example.com",
			appURL:      "https://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "invalid URL",
			url:         ":foo",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "non-Grafana URL without scheme",
			url:         "example.com",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "non-Grafana URL without scheme",
			url:         "www.example.com",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "URL path is a host with two leading slashes",
			url:         "//example.com",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "URL path is a host with three leading slashes",
			url:         "///example.com",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "URL path is an IP address with two leading slashes",
			url:         "//0.0.0.0",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
		{
			desc:        "URL path is an IP address with three leading slashes",
			url:         "///0.0.0.0",
			appURL:      "http://localhost:3000/",
			redirectURL: "/",
		},
	}

	for _, c := range redirectCases {
		hs.Cfg.AppURL = c.appURL
		hs.Cfg.AppSubURL = c.appSubURL

		t.Run(c.desc, func(t *testing.T) {
			if c.desc == "grafana invalid relative url starting with subpath" {
				fmt.Println()
			}
			expCookiePath := "/"
			if len(hs.Cfg.AppSubURL) > 0 {
				expCookiePath = hs.Cfg.AppSubURL
			}
			cookie := http.Cookie{
				Name:     "redirect_to",
				MaxAge:   60,
				Value:    c.url,
				HttpOnly: true,
				Path:     expCookiePath,
				Secure:   hs.Cfg.CookieSecure,
				SameSite: hs.Cfg.CookieSameSiteMode,
			}
			sc.m.Post(sc.url, sc.defaultHandler)
			sc.fakeReqNoAssertionsWithCookie("POST", sc.url, cookie).exec()
			require.Equal(t, 200, sc.resp.Code)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			redirectURL := respJSON.Get("redirectUrl").MustString()
			assert.Equal(t, c.redirectURL, redirectURL)

			// assert redirect_to cookie is deleted
			setCookie, ok := sc.resp.Header()["Set-Cookie"]
			assert.True(t, ok, "Set-Cookie exists")
			assert.Greater(t, len(setCookie), 0)
			var redirectToCookieFound bool
			expCookieValue := fmt.Sprintf("redirect_to=; Path=%v; Max-Age=0; HttpOnly; Secure", expCookiePath)
			for _, cookieValue := range setCookie {
				if cookieValue == expCookieValue {
					redirectToCookieFound = true
					break
				}
			}
			assert.True(t, redirectToCookieFound)
		})
	}
}

func TestLoginOAuthRedirect(t *testing.T) {
	fakeSetIndexViewData(t)

	sc := setupScenarioContext(t, "/login")
	cfg := setting.NewCfg()
	mock := &mockSocialService{
		oAuthInfo: &social.OAuthInfo{
			ClientId:     "fake",
			ClientSecret: "fakefake",
			Enabled:      true,
			AllowSignup:  true,
			Name:         "github",
		},
		oAuthInfos: oAuthInfos,
	}
	hs := &HTTPServer{
		authnService:     &authntest.FakeService{},
		Cfg:              cfg,
		SettingsProvider: &setting.OSSImpl{Cfg: cfg},
		License:          &licensing.OSSLicensingService{},
		SocialService:    mock,
		Features:         featuremgmt.WithFeatures(),
	}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	hs.Cfg.OAuthAutoLogin = true
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()

	require.Equal(t, 307, sc.resp.Code)
	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, "/login/github", location[0])
}

func TestLoginInternal(t *testing.T) {
	fakeSetIndexViewData(t)

	fakeViewIndex(t)
	sc := setupScenarioContext(t, "/login")
	hs := &HTTPServer{
		Cfg:      setting.NewCfg(),
		License:  &licensing.OSSLicensingService{},
		log:      log.New("test"),
		Features: featuremgmt.WithFeatures(),
	}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.Req.URL.RawQuery = "disableAutoLogin=true"
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	hs.Cfg.OAuthAutoLogin = true
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()

	// Shouldn't redirect to the OAuth login URL
	assert.Equal(t, 200, sc.resp.Code)
}

func TestAuthProxyLoginEnableLoginTokenDisabled(t *testing.T) {
	sc := setupAuthProxyLoginTest(t, false)

	require.Equal(t, 302, sc.resp.Code)
	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, "/", location[0])

	_, ok = sc.resp.Header()["Set-Cookie"]
	assert.False(t, ok, "Set-Cookie does not exist")
}

func TestAuthProxyLoginWithEnableLoginToken(t *testing.T) {
	sc := setupAuthProxyLoginTest(t, true)
	require.Equal(t, 302, sc.resp.Code)

	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, "/", location[0])
	setCookie := sc.resp.Header()["Set-Cookie"]
	require.NotNil(t, setCookie, "Set-Cookie should exist")
	assert.Equal(t, fmt.Sprintf("%s=; Path=/; Max-Age=0; HttpOnly", loginCookieName), setCookie[0])
}

func TestAuthProxyLoginWithEnableLoginTokenAndEnabledOauthAutoLogin(t *testing.T) {
	fakeSetIndexViewData(t)

	mock := &mockSocialService{
		oAuthInfo: &social.OAuthInfo{
			ClientId:     "fake",
			ClientSecret: "fakefake",
			Enabled:      true,
			AllowSignup:  true,
			Name:         "github",
		},
		oAuthInfos: oAuthInfos,
	}

	sc := setupScenarioContext(t, "/login")
	sc.cfg.LoginCookieName = loginCookieName
	sc.cfg.OAuthAutoLogin = true
	hs := &HTTPServer{
		Cfg:              sc.cfg,
		SettingsProvider: &setting.OSSImpl{Cfg: sc.cfg},
		License:          &licensing.OSSLicensingService{},
		AuthTokenService: authtest.NewFakeUserAuthTokenService(),
		log:              log.New("hello"),
		SocialService:    mock,
		Features:         featuremgmt.WithFeatures(),
	}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.IsSignedIn = true
		c.SignedInUser = &user.SignedInUser{
			UserID:          10,
			AuthenticatedBy: loginservice.AuthProxyAuthModule,
		}
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	sc.cfg.AuthProxy.Enabled = true
	sc.cfg.AuthProxy.EnableLoginToken = true

	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()
	require.Equal(t, 302, sc.resp.Code)

	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, "/", location[0])
	setCookie := sc.resp.Header()["Set-Cookie"]
	require.NotNil(t, setCookie, "Set-Cookie should exist")
	assert.Equal(t, fmt.Sprintf("%s=; Path=/; Max-Age=0; HttpOnly", loginCookieName), setCookie[0])
}

func setupAuthProxyLoginTest(t *testing.T, enableLoginToken bool) *scenarioContext {
	fakeSetIndexViewData(t)

	sc := setupScenarioContext(t, "/login")
	sc.cfg.LoginCookieName = loginCookieName
	hs := &HTTPServer{
		Cfg:              sc.cfg,
		SettingsProvider: &setting.OSSImpl{Cfg: sc.cfg},
		License:          &licensing.OSSLicensingService{},
		AuthTokenService: authtest.NewFakeUserAuthTokenService(),
		log:              log.New("hello"),
		SocialService:    &mockSocialService{},
		Features:         featuremgmt.WithFeatures(),
	}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.IsSignedIn = true
		c.SignedInUser = &user.SignedInUser{
			UserID:          10,
			AuthenticatedBy: loginservice.AuthProxyAuthModule,
		}
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	sc.cfg.AuthProxy.Enabled = true
	sc.cfg.AuthProxy.EnableLoginToken = enableLoginToken

	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()

	return sc
}

func TestLogoutSaml(t *testing.T) {
	fakeSetIndexViewData(t)
	fakeViewIndex(t)
	sc := setupScenarioContextSamlLogout(t, "/logout")
	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "saml").Return(true)

	hs := &HTTPServer{
		authnService:     &authntest.FakeService{},
		Cfg:              sc.cfg,
		SettingsProvider: &setting.OSSImpl{Cfg: sc.cfg},
		License:          license,
		SocialService:    &mockSocialService{},
		Features:         featuremgmt.WithFeatures(),
		authInfoService: &authinfotest.FakeService{
			ExpectedUserAuth: &loginservice.UserAuth{AuthModule: loginservice.SAMLAuthModule},
		},
	}

	assert.Equal(t, true, hs.samlSingleLogoutEnabled())
	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		c.SignedInUser = &user.SignedInUser{
			UserID:          1,
			AuthenticatedBy: loginservice.SAMLAuthModule,
		}
		hs.Logout(c)
		return response.Empty(http.StatusOK)
	})
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()
	require.Equal(t, 302, sc.resp.Code)
}

type mockSocialService struct {
	oAuthInfo       *social.OAuthInfo
	oAuthInfos      map[string]*social.OAuthInfo
	oAuthProviders  map[string]bool
	httpClient      *http.Client
	socialConnector social.SocialConnector
	err             error
}

func (m *mockSocialService) GetOAuthInfoProvider(name string) *social.OAuthInfo {
	return m.oAuthInfo
}

func (m *mockSocialService) GetOAuthInfoProviders() map[string]*social.OAuthInfo {
	return m.oAuthInfos
}

func (m *mockSocialService) GetOAuthProviders() map[string]bool {
	return m.oAuthProviders
}

func (m *mockSocialService) GetOAuthHttpClient(name string) (*http.Client, error) {
	return m.httpClient, m.err
}

func (m *mockSocialService) GetConnector(string) (social.SocialConnector, error) {
	return m.socialConnector, m.err
}
