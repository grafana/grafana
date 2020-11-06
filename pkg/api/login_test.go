package api

import (
	"encoding/hex"
	"errors"
	"fmt"
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
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	desc        string
	url         string
	status      int
	err         error
	appURL      string
	appSubURL   string
	redirectURL string
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
	expCookiePath := "/"
	if len(setting.AppSubUrl) > 0 {
		expCookiePath = setting.AppSubUrl
	}
	cookie := http.Cookie{
		Name:     LoginErrorCookieName,
		MaxAge:   60,
		Value:    hex.EncodeToString(encryptedError),
		HttpOnly: true,
		Path:     expCookiePath,
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
		hs.Cfg.AppUrl = c.appURL
		hs.Cfg.AppSubUrl = c.appSubURL
		t.Run(c.desc, func(t *testing.T) {
			expCookiePath := "/"
			if len(hs.Cfg.AppSubUrl) > 0 {
				expCookiePath = hs.Cfg.AppSubUrl
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
			assert.Equal(t, c.status, sc.resp.Code)
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
		HooksService:     &hooks.HooksService{},
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
			appURL: "https://localhost:3000/",
		},
		{
			desc:      "grafana relative url with subpath with leading slash",
			url:       "/grafana/profile",
			appURL:    "https://localhost:3000/",
			appSubURL: "/grafana",
		},
		{
			desc:      "grafana invalid relative url starting with subpath",
			url:       "/grafanablah",
			appURL:    "https://localhost:3000/",
			appSubURL: "/grafana",
			err:       login.ErrInvalidRedirectTo,
		},
		{
			desc:      "relative url with missing subpath",
			url:       "/profile",
			appURL:    "https://localhost:3000/",
			appSubURL: "/grafana",
			err:       login.ErrInvalidRedirectTo,
		},
		{
			desc:   "grafana absolute url",
			url:    "http://localhost:3000/profile",
			appURL: "http://localhost:3000/",
			err:    login.ErrAbsoluteRedirectTo,
		},
		{
			desc:   "non grafana absolute url",
			url:    "http://example.com",
			appURL: "https://localhost:3000/",
			err:    login.ErrAbsoluteRedirectTo,
		},
		{
			desc:   "invalid URL",
			url:    ":foo",
			appURL: "http://localhost:3000/",
			err:    login.ErrInvalidRedirectTo,
		},
		{
			desc:   "non-Grafana URL without scheme",
			url:    "example.com",
			appURL: "http://localhost:3000/",
			err:    login.ErrForbiddenRedirectTo,
		},
		{
			desc:   "non-Grafana URL without scheme",
			url:    "www.example.com",
			appURL: "http://localhost:3000/",
			err:    login.ErrForbiddenRedirectTo,
		},
		{
			desc:   "URL path is a host with two leading slashes",
			url:    "//example.com",
			appURL: "http://localhost:3000/",
			err:    login.ErrForbiddenRedirectTo,
		},
		{
			desc:   "URL path is a host with three leading slashes",
			url:    "///example.com",
			appURL: "http://localhost:3000/",
			err:    login.ErrForbiddenRedirectTo,
		},
		{
			desc:   "URL path is an IP address with two leading slashes",
			url:    "//0.0.0.0",
			appURL: "http://localhost:3000/",
			err:    login.ErrForbiddenRedirectTo,
		},
		{
			desc:   "URL path is an IP address with three leading slashes",
			url:    "///0.0.0.0",
			appURL: "http://localhost:3000/",
			err:    login.ErrForbiddenRedirectTo,
		},
	}

	for _, c := range redirectCases {
		hs.Cfg.AppUrl = c.appURL
		hs.Cfg.AppSubUrl = c.appSubURL
		t.Run(c.desc, func(t *testing.T) {
			expCookiePath := "/"
			if len(hs.Cfg.AppSubUrl) > 0 {
				expCookiePath = hs.Cfg.AppSubUrl
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

type loginHookTest struct {
	info *models.LoginInfo
}

func (r *loginHookTest) LoginHook(loginInfo *models.LoginInfo, req *models.ReqContext) {
	r.info = loginInfo
}

func TestLoginPostRunLokingHook(t *testing.T) {
	sc := setupScenarioContext("/login")
	hookService := &hooks.HooksService{}
	hs := &HTTPServer{
		log:              log.New("test"),
		Cfg:              setting.NewCfg(),
		License:          &licensing.OSSLicensingService{},
		AuthTokenService: auth.NewFakeUserAuthTokenService(),
		HooksService:     hookService,
	}

	sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) Response {
		cmd := dtos.LoginCommand{
			User:     "admin",
			Password: "admin",
		}
		return hs.LoginPost(c, cmd)
	})

	testHook := loginHookTest{}
	hookService.AddLoginHook(testHook.LoginHook)

	testUser := &models.User{
		Id:    42,
		Email: "",
	}

	testCases := []struct {
		desc       string
		authUser   *models.User
		authModule string
		authErr    error
		info       models.LoginInfo
	}{
		{
			desc:    "invalid credentials",
			authErr: login.ErrInvalidCredentials,
			info: models.LoginInfo{
				AuthModule: "",
				HTTPStatus: 401,
				Error:      login.ErrInvalidCredentials,
			},
		},
		{
			desc:    "user disabled",
			authErr: login.ErrUserDisabled,
			info: models.LoginInfo{
				AuthModule: "",
				HTTPStatus: 401,
				Error:      login.ErrUserDisabled,
			},
		},
		{
			desc:       "valid Grafana user",
			authUser:   testUser,
			authModule: "grafana",
			info: models.LoginInfo{
				AuthModule: "grafana",
				User:       testUser,
				HTTPStatus: 200,
			},
		},
		{
			desc:       "valid LDAP user",
			authUser:   testUser,
			authModule: "ldap",
			info: models.LoginInfo{
				AuthModule: "ldap",
				User:       testUser,
				HTTPStatus: 200,
			},
		},
	}

	for _, c := range testCases {
		t.Run(c.desc, func(t *testing.T) {
			bus.AddHandler("grafana-auth", func(query *models.LoginUserQuery) error {
				query.User = c.authUser
				query.AuthModule = c.authModule
				return c.authErr
			})

			sc.m.Post(sc.url, sc.defaultHandler)
			sc.fakeReqNoAssertions("POST", sc.url).exec()

			info := testHook.info
			assert.Equal(t, c.info.AuthModule, info.AuthModule)
			assert.Equal(t, "admin", info.LoginUsername)
			assert.Equal(t, c.info.HTTPStatus, info.HTTPStatus)
			assert.Equal(t, c.info.Error, info.Error)

			if c.info.User != nil {
				require.NotEmpty(t, info.User)
				assert.Equal(t, c.info.User.Id, info.User.Id)
			}
		})
	}
}
