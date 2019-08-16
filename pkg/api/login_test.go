package api

import (
	"encoding/hex"
	"errors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
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

func TestLoginErrorCookieApiEndpoint(t *testing.T) {
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	mockViewIndex()
	defer resetViewIndex()

	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		Cfg: setting.NewCfg(),
	}

	sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) {
		hs.LoginView(c)
	})

	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)
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
		SameSite: hs.Cfg.CookieSameSite,
	}
	sc.m.Get(sc.url, sc.defaultHandler)
	sc.fakeReqNoAssertionsWithCookie("GET", sc.url, cookie).exec()
	assert.Equal(t, sc.resp.Code, 200)

	responseString, err := getBody(sc.resp)
	assert.Nil(t, err)
	assert.True(t, strings.Contains(responseString, oauthError.Error()))
}

func TestLoginOAuthRedirect(t *testing.T) {
	mockSetIndexViewData()
	defer resetSetIndexViewData()

	sc := setupScenarioContext("/login")
	hs := &HTTPServer{
		Cfg: setting.NewCfg(),
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
