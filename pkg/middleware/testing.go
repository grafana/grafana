package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/apikey/apikeytest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

type scenarioContext struct {
	t                    *testing.T
	m                    *web.Mux
	context              *models.ReqContext
	resp                 *httptest.ResponseRecorder
	apiKey               string
	authHeader           string
	jwtAuthHeader        string
	tokenSessionCookie   string
	respJson             map[string]interface{}
	handlerFunc          handlerFunc
	defaultHandler       web.Handler
	url                  string
	userAuthTokenService *auth.FakeUserAuthTokenService
	jwtAuthService       *models.FakeJWTService
	remoteCacheService   *remotecache.RemoteCache
	cfg                  *setting.Cfg
	sqlStore             sqlstore.Store
	mockSQLStore         *mockstore.SQLStoreMock
	contextHandler       *contexthandler.ContextHandler
	loginService         *loginservice.LoginServiceMock
	apiKeyService        *apikeytest.Service
	userService          *usertest.FakeUserService

	req *http.Request
}

func (sc *scenarioContext) withValidApiKey() *scenarioContext {
	sc.apiKey = "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9"
	return sc
}

func (sc *scenarioContext) withTokenSessionCookie(unhashedToken string) *scenarioContext {
	sc.tokenSessionCookie = unhashedToken
	return sc
}

func (sc *scenarioContext) withAuthorizationHeader(authHeader string) *scenarioContext {
	sc.authHeader = authHeader
	return sc
}

func (sc *scenarioContext) withJWTAuthHeader(jwtAuthHeader string) *scenarioContext {
	sc.jwtAuthHeader = jwtAuthHeader
	return sc
}

func (sc *scenarioContext) fakeReq(method, url string) *scenarioContext {
	sc.t.Helper()

	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(sc.t, err)
	sc.req = req

	return sc
}

func (sc *scenarioContext) fakeReqWithParams(method, url string, queryParams map[string]string) *scenarioContext {
	sc.t.Helper()

	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(sc.t, err)

	q := req.URL.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()
	require.NoError(sc.t, err)
	sc.req = req

	return sc
}

func (sc *scenarioContext) exec() {
	sc.t.Helper()

	if sc.apiKey != "" {
		sc.t.Logf(`Adding header "Authorization: Bearer %s"`, sc.apiKey)
		sc.req.Header.Set("Authorization", "Bearer "+sc.apiKey)
	}

	if sc.authHeader != "" {
		sc.t.Logf(`Adding header "Authorization: %s"`, sc.authHeader)
		sc.req.Header.Set("Authorization", sc.authHeader)
	}

	if sc.jwtAuthHeader != "" {
		sc.t.Logf(`Adding header "%s: %s"`, sc.cfg.JWTAuthHeaderName, sc.jwtAuthHeader)
		sc.req.Header.Set(sc.cfg.JWTAuthHeaderName, sc.jwtAuthHeader)
	}

	if sc.tokenSessionCookie != "" {
		sc.t.Log(`Adding cookie`, "name", sc.cfg.LoginCookieName, "value", sc.tokenSessionCookie)
		sc.req.AddCookie(&http.Cookie{
			Name:  sc.cfg.LoginCookieName,
			Value: sc.tokenSessionCookie,
		})
	}
	sc.m.ServeHTTP(sc.resp, sc.req)

	if sc.resp.Header().Get("Content-Type") == "application/json; charset=UTF-8" {
		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.NoError(sc.t, err)
		sc.t.Log("Decoded JSON", "json", sc.respJson)
	} else {
		sc.t.Log("Not decoding JSON")
	}
}

type scenarioFunc func(t *testing.T, c *scenarioContext)
type handlerFunc func(c *models.ReqContext)
