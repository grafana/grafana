package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

type scenarioContext struct {
	service              *MiddlewareService
	m                    *macaron.Macaron
	context              *models.ReqContext
	resp                 *httptest.ResponseRecorder
	apiKey               string
	authHeader           string
	tokenSessionCookie   string
	respJson             map[string]interface{}
	handlerFunc          handlerFunc
	defaultHandler       macaron.Handler
	url                  string
	userAuthTokenService *auth.FakeUserAuthTokenService
	remoteCacheService   *remotecache.RemoteCache

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

func (sc *scenarioContext) fakeReq(t *testing.T, method, url string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(t, err)
	sc.req = req

	return sc
}

func (sc *scenarioContext) fakeReqWithParams(t *testing.T, method, url string, queryParams map[string]string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(t, err)

	q := req.URL.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()
	sc.req = req

	return sc
}

func (sc *scenarioContext) exec(t *testing.T) {
	if sc.apiKey != "" {
		sc.req.Header.Add("Authorization", "Bearer "+sc.apiKey)
	}

	if sc.authHeader != "" {
		sc.req.Header.Add("Authorization", sc.authHeader)
	}

	if sc.tokenSessionCookie != "" {
		t.Log("Adding cookie", "name", sc.service.Cfg.LoginCookieName, "value", sc.tokenSessionCookie)
		sc.req.AddCookie(&http.Cookie{
			Name:  sc.service.Cfg.LoginCookieName,
			Value: sc.tokenSessionCookie,
		})
	}

	t.Log("Making fake HTTP request", "method", sc.req.Method, "url", sc.req.URL)
	sc.m.ServeHTTP(sc.resp, sc.req)

	t.Log("Fake HTTP request handled", "status", sc.resp.Code)

	if sc.resp.Header().Get("Content-Type") == "application/json; charset=UTF-8" {
		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.NoError(t, err)
		t.Log("Decoded JSON", "json", sc.respJson)
	} else {
		t.Log("Not decoding JSON")
	}
}

type handlerFunc func(c *models.ReqContext)

type fakeRenderService struct {
	rendering.Service
}

func (s *fakeRenderService) Init() error {
	return nil
}

type FakeServiceCfg struct {
	UserAuthTokenService *auth.FakeUserAuthTokenService
	RemoteCacheService   *remotecache.RemoteCache
}

// FakeService returns a MiddlewareService for testing.
func FakeService(t *testing.T, cfgs ...FakeServiceCfg) *MiddlewareService {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.LoginCookieName = "grafana_session"
	var err error
	cfg.LoginMaxLifetime, err = gtime.ParseDuration("30d")
	cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{
		Name:    "database",
		ConnStr: "",
	}

	var remoteCacheSvc *remotecache.RemoteCache
	var userAuthTokenSvc *auth.FakeUserAuthTokenService
	for _, cfg := range cfgs {
		if cfg.RemoteCacheService != nil {
			remoteCacheSvc = cfg.RemoteCacheService
		}
		if cfg.UserAuthTokenService != nil {
			userAuthTokenSvc = cfg.UserAuthTokenService
		}
	}
	if remoteCacheSvc == nil {
		remoteCacheSvc = &remotecache.RemoteCache{}
	}
	if userAuthTokenSvc == nil {
		userAuthTokenSvc = auth.NewFakeUserAuthTokenService()
	}

	sqlStore := sqlstore.InitTestDB(t)
	renderSvc := &fakeRenderService{}
	svc := &MiddlewareService{}
	err = registry.BuildServiceGraph([]interface{}{cfg}, []*registry.Descriptor{
		{
			Name:     sqlstore.ServiceName,
			Instance: sqlStore,
		},
		{
			Name:     remotecache.ServiceName,
			Instance: remoteCacheSvc,
		},
		{
			Name:     auth.ServiceName,
			Instance: userAuthTokenSvc,
		},
		{
			Name:     rendering.ServiceName,
			Instance: renderSvc,
		},
		{
			Name:     serviceName,
			Instance: svc,
		},
	})
	require.NoError(t, err)

	return svc
}
