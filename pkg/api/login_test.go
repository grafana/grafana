package api

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

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
	loginservice "github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

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
		return "index-template"
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

func TestLoginView_ErrorCookie(t *testing.T) {
	var cfg *setting.Cfg
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg = setting.NewCfg()
		hs.Cfg = cfg
		hs.SocialService = &mockSocialService{}
		hs.SettingsProvider = &setting.OSSImpl{Cfg: hs.Cfg}
		hs.SecretsService = fakes.NewFakeSecretsService()
	})

	fakeSetIndexViewData(t)

	req := server.NewGetRequest("/login")
	req.AddCookie(&http.Cookie{
		Name:     loginErrorCookieName,
		MaxAge:   60,
		Value:    hex.EncodeToString([]byte("authentication error")),
		HttpOnly: true,
		Path:     "/",
		Secure:   cfg.CookieSecure,
		SameSite: cfg.CookieSameSiteMode,
	})

	res, err := server.Send(req)
	require.NoError(t, err)

	require.Equal(t, http.StatusOK, res.StatusCode)

	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	assert.Contains(t, string(body), "authentication error")
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
			ExpectedIdentity: &authn.Identity{ID: "user:42", SessionToken: &usertoken.UserToken{}},
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
	assert.Equal(t, "grafana_session=; Path=/; Max-Age=0; HttpOnly", setCookie[0])
}

func setupAuthProxyLoginTest(t *testing.T, enableLoginToken bool) *scenarioContext {
	fakeSetIndexViewData(t)

	sc := setupScenarioContext(t, "/login")
	sc.cfg.LoginCookieName = "grafana_session"
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
			UserID: 10,
		}
		hs.LoginView(c)
		return response.Empty(http.StatusOK)
	})

	sc.cfg.AuthProxyEnabled = true
	sc.cfg.AuthProxyEnableLoginToken = enableLoginToken

	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()

	return sc
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

type fakeAuthenticator struct {
	ExpectedUser       *user.User
	ExpectedAuthModule string
	ExpectedError      error
}

func (fa *fakeAuthenticator) AuthenticateUser(c context.Context, query *loginservice.LoginUserQuery) error {
	query.User = fa.ExpectedUser
	query.AuthModule = fa.ExpectedAuthModule
	return fa.ExpectedError
}
