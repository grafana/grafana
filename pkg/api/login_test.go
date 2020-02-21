package api

import (
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
)

func mockSetIndexViewData() {
	setIndexViewData = func(*HTTPServer, *models.ReqContext) (*dtos.IndexViewData, error) {
		data := &dtos.IndexViewData{
			User:     &dtos.CurrentUser{},
			Settings: map[string]interface{}{},
			NavTree:  []*dtos.NavLink{},
		}
		return data, nil
	}
}

func resetSetIndexViewData() {
	setIndexViewData = (*HTTPServer).setIndexViewData
}

func mockViewIndex() {
	getViewIndex = func() string {
		return "index-template"
	}
}

func resetViewIndex() {
	getViewIndex = func() string {
		return ViewIndex
	}
}

func getBody(resp *httptest.ResponseRecorder) (string, error) {
	responseData, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(responseData), nil
}

type FakeLogger struct {
	log.Logger
}

func (stub *FakeLogger) Info(testMessage string, ctx ...interface{}) {
}

type redirectCase struct {
	desc      string
	url       string
	status    int
	err       error
	appURL    string
	appSubURL string
	path      string
}

func TestLoginErrorCookieApiEndpoint(t *testing.T) {
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	mockViewIndex()
	defer resetViewIndex()

	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		Cfg:     setting.NewCfg(),
		License: &licensing.OSSLicensingService{},
	}

	sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) {
		hs.LoginView(c)
	})

	setting.LoginCookieName = "grafana_session"
	setting.SecretKey = "login_testing"

	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)
	setting.OAuthService.OAuthInfos["github"] = &setting.OAuthInfo{
		ClientId:     "fake",
		ClientSecret: "fakefake",
		Enabled:      true,
		AllowSignup:  true,
		Name:         "github",
	}
	setting.OAuthAutoLogin = true

	oauthError := errors.New("User not a member of one of the required organizations")
	encryptedError, _ := util.Encrypt([]byte(oauthError.Error()), setting.SecretKey)
	cookie := http.Cookie{
		Name:     LoginErrorCookieName,
		MaxAge:   60,
		Value:    hex.EncodeToString(encryptedError),
		HttpOnly: true,
		Path:     setting.AppSubUrl + "/",
		Secure:   hs.Cfg.CookieSecure,
		SameSite: hs.Cfg.CookieSameSiteMode,
	}
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertionsWithCookie("GET", sc.url, cookie).exec()
	assert.Equal(t, sc.resp.Code, 200)

	responseString, err := getBody(sc.resp)
	assert.NoError(t, err)
	assert.True(t, strings.Contains(responseString, oauthError.Error()))
}

func TestLoginViewRedirect(t *testing.T) {
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	mockViewIndex()
	defer resetViewIndex()
	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		Cfg:     setting.NewCfg(),
		License: &licensing.OSSLicensingService{},
	}
	hs.Cfg.CookieSecure = true

	sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) {
		c.IsSignedIn = true
		c.SignedInUser = &models.SignedInUser{
			UserId: 10,
		}
		hs.LoginView(c)
	})

	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)

	redirectCases := []redirectCase{
		{
			desc:   "grafana relative url without subpath",
			url:    "/profile",
			appURL: "http://localhost:3000",
			path:   "/",
			status: 302,
		},
		{
			desc:      "grafana relative url with subpath",
			url:       "/grafana/profile",
			appURL:    "http://localhost:3000",
			appSubURL: "grafana",
			path:      "grafana/",
			status:    302,
		},
		{
			desc:      "grafana slashed relative url with subpath",
			url:       "/grafana/profile",
			appURL:    "http://localhost:3000",
			appSubURL: "grafana",
			path:      "/grafana/",
			status:    302,
		},
		{
			desc:      "relative url with missing subpath",
			url:       "/profile",
			appURL:    "http://localhost:3000",
			appSubURL: "grafana",
			path:      "grafana/",
			status:    200,
			err:       login.ErrInvalidRedirectTo,
		},
		{
			desc:      "grafana subpath absolute url",
			url:       "http://localhost:3000/grafana/profile",
			appURL:    "http://localhost:3000",
			appSubURL: "grafana",
			path:      "/grafana/profile",
			status:    200,
		},
		{
			desc:   "grafana absolute url",
			url:    "http://localhost:3000/profile",
			appURL: "http://localhost:3000",
			path:   "/",
			status: 200,
			err:    login.ErrAbsoluteRedirectTo,
		},
		{
			desc:   "non grafana absolute url",
			url:    "http://example.com",
			appURL: "http://localhost:3000",
			path:   "/",
			status: 200,
			err:    login.ErrAbsoluteRedirectTo,
		},
		{
			desc:   "invalid url",
			url:    ":foo",
			appURL: "http://localhost:3000",
			path:   "/",
			status: 200,
			err:    login.ErrInvalidRedirectTo,
		},
	}

	for _, c := range redirectCases {
		hs.Cfg.AppUrl = c.appURL
		hs.Cfg.AppSubUrl = c.appSubURL
		t.Run(c.desc, func(t *testing.T) {
			cookie := http.Cookie{
				Name:     "redirect_to",
				MaxAge:   60,
				Value:    c.url,
				HttpOnly: true,
				Path:     c.path,
				Secure:   hs.Cfg.CookieSecure,
				SameSite: hs.Cfg.CookieSameSiteMode,
			}
			sc.m.Get(sc.url, sc.defaultHandler)
			sc.fakeReqNoAssertionsWithCookie("GET", sc.url, cookie).exec()
			assert.Equal(t, c.status, sc.resp.Code)
			if c.status == 302 {
				location, ok := sc.resp.Header()["Location"]
				assert.True(t, ok)
				assert.Equal(t, location[0], c.url)

				setCookie, ok := sc.resp.Header()["Set-Cookie"]
				assert.True(t, ok, "Set-Cookie exists")
				assert.Greater(t, len(setCookie), 0)
				var redirectToCookieFound bool
				expCookieValue := fmt.Sprintf("redirect_to=%v; Path=%v; Max-Age=60; HttpOnly; Secure", c.url, c.path)
				for _, cookieValue := range setCookie {
					if cookieValue == expCookieValue {
						redirectToCookieFound = true
						break
					}
				}
				assert.True(t, redirectToCookieFound)
			}

			responseString, err := getBody(sc.resp)
			assert.NoError(t, err)
			if c.err != nil {
				assert.True(t, strings.Contains(responseString, c.err.Error()))
			}
		})
	}
}

func TestLoginPostRedirect(t *testing.T) {
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	mockViewIndex()
	defer resetViewIndex()
	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		log:              &FakeLogger{},
		Cfg:              setting.NewCfg(),
		License:          &licensing.OSSLicensingService{},
		AuthTokenService: auth.NewFakeUserAuthTokenService(),
	}
	hs.Cfg.CookieSecure = true

	sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) Response {
		cmd := dtos.LoginCommand{
			User:     "admin",
			Password: "admin",
		}
		return hs.LoginPost(c, cmd)
	})

	bus.AddHandler("grafana-auth", func(query *models.LoginUserQuery) error {
		query.User = &models.User{
			Id:    42,
			Email: "",
		}
		return nil
	})

	redirectCases := []redirectCase{
		{
			desc:   "grafana relative url without subpath",
			url:    "/profile",
			appURL: "https://localhost:3000",
		},
		{
			desc:      "grafana relative url with subpath",
			url:       "/grafana/profile",
			appURL:    "https://localhost:3000",
			appSubURL: "grafana",
		},
		{
			desc:      "grafana no slash relative url with subpath",
			url:       "grafana/profile",
			appURL:    "https://localhost:3000",
			appSubURL: "grafana",
		},
		{
			desc:      "relative url with missing subpath",
			url:       "/profile",
			appURL:    "https://localhost:3000",
			appSubURL: "grafana",
			err:       login.ErrInvalidRedirectTo,
		},
		{
			desc:   "grafana absolute url",
			url:    "http://localhost:3000/profile",
			appURL: "http://localhost:3000",
			err:    login.ErrAbsoluteRedirectTo,
		},
		{
			desc:   "non grafana absolute url",
			url:    "http://example.com",
			appURL: "https://localhost:3000",
			err:    login.ErrAbsoluteRedirectTo,
		},
	}

	for _, c := range redirectCases {
		hs.Cfg.AppUrl = c.appURL
		hs.Cfg.AppSubUrl = c.appSubURL
		t.Run(c.desc, func(t *testing.T) {
			cookie := http.Cookie{
				Name:     "redirect_to",
				MaxAge:   60,
				Value:    c.url,
				HttpOnly: true,
				Path:     hs.Cfg.AppSubUrl + "/",
				Secure:   hs.Cfg.CookieSecure,
				SameSite: hs.Cfg.CookieSameSiteMode,
			}
			sc.m.Post(sc.url, sc.defaultHandler)
			sc.fakeReqNoAssertionsWithCookie("POST", sc.url, cookie).exec()
			assert.Equal(t, sc.resp.Code, 200)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			assert.NoError(t, err)
			redirectURL := respJSON.Get("redirectUrl").MustString()
			if c.err != nil {
				assert.Equal(t, "", redirectURL)
			} else {
				assert.Equal(t, c.url, redirectURL)
			}
			// assert redirect_to cookie is deleted
			setCookie, ok := sc.resp.Header()["Set-Cookie"]
			assert.True(t, ok, "Set-Cookie exists")
			assert.Greater(t, len(setCookie), 0)
			var redirectToCookieFound bool
			expCookieValue := fmt.Sprintf("redirect_to=; Path=%v; Max-Age=0; HttpOnly; Secure", hs.Cfg.AppSubUrl+"/")
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
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		Cfg:     setting.NewCfg(),
		License: &licensing.OSSLicensingService{},
	}

	sc.defaultHandler = Wrap(func(c *models.ReqContext) {
		hs.LoginView(c)
	})

	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)
	setting.OAuthService.OAuthInfos["github"] = &setting.OAuthInfo{
		ClientId:     "fake",
		ClientSecret: "fakefake",
		Enabled:      true,
		AllowSignup:  true,
		Name:         "github",
	}
	setting.OAuthAutoLogin = true
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()

	assert.Equal(t, sc.resp.Code, 307)
	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, location[0], "/login/github")
}

func TestAuthProxyLoginEnableLoginTokenDisabled(t *testing.T) {
	sc := setupAuthProxyLoginTest(false)

	assert.Equal(t, sc.resp.Code, 302)
	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, location[0], "/")

	_, ok = sc.resp.Header()["Set-Cookie"]
	assert.False(t, ok, "Set-Cookie does not exist")
}

func TestAuthProxyLoginWithEnableLoginToken(t *testing.T) {
	sc := setupAuthProxyLoginTest(true)

	assert.Equal(t, sc.resp.Code, 302)
	location, ok := sc.resp.Header()["Location"]
	assert.True(t, ok)
	assert.Equal(t, location[0], "/")

	setCookie, ok := sc.resp.Header()["Set-Cookie"]
	assert.True(t, ok, "Set-Cookie exists")
	assert.Equal(t, "grafana_session=; Path=/; Max-Age=0; HttpOnly", setCookie[0])
}

func setupAuthProxyLoginTest(enableLoginToken bool) *scenarioContext {
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		Cfg:              setting.NewCfg(),
		License:          &licensing.OSSLicensingService{},
		AuthTokenService: auth.NewFakeUserAuthTokenService(),
		log:              log.New("hello"),
	}

	sc.defaultHandler = Wrap(func(c *models.ReqContext) {
		c.IsSignedIn = true
		c.SignedInUser = &models.SignedInUser{
			UserId: 10,
		}
		hs.LoginView(c)
	})

	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)
	setting.AuthProxyEnabled = true
	setting.AuthProxyEnableLoginToken = enableLoginToken

	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertions("GET", sc.url).exec()

	return sc
}
