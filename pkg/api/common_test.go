package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func loggedInUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	loggedInUserScenarioWithRole(t, desc, "GET", url, routePattern, models.ROLE_EDITOR, fn)
}

func loggedInUserScenarioWithRole(t *testing.T, desc string, method string, url string, routePattern string, role models.RoleType, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.Login = testUserLogin
			sc.context.OrgRole = role
			if sc.handlerFunc != nil {
				return sc.handlerFunc(sc.context)
			}

			return nil
		})

		switch method {
		case "GET":
			sc.m.Get(routePattern, sc.defaultHandler)
		case "DELETE":
			sc.m.Delete(routePattern, sc.defaultHandler)
		}

		fn(sc)
	})
}

func anonymousUserScenario(t *testing.T, desc string, method string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			if sc.handlerFunc != nil {
				return sc.handlerFunc(sc.context)
			}

			return nil
		})

		switch method {
		case "GET":
			sc.m.Get(routePattern, sc.defaultHandler)
		case "DELETE":
			sc.m.Delete(routePattern, sc.defaultHandler)
		}

		fn(sc)
	})
}

func (sc *scenarioContext) fakeReq(method, url string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(sc.t, err)
	sc.req = req

	return sc
}

func (sc *scenarioContext) fakeReqWithParams(method, url string, queryParams map[string]string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	// TODO: Depend on sc.t
	if sc.t != nil {
		require.NoError(sc.t, err)
	} else if err != nil {
		panic(fmt.Sprintf("Making request failed: %s", err))
	}

	q := req.URL.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()
	sc.req = req
	return sc
}

func (sc *scenarioContext) fakeReqNoAssertions(method, url string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, _ := http.NewRequest(method, url, nil)
	sc.req = req

	return sc
}

func (sc *scenarioContext) fakeReqNoAssertionsWithCookie(method, url string, cookie http.Cookie) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	http.SetCookie(sc.resp, &cookie)

	req, _ := http.NewRequest(method, url, nil)
	req.Header = http.Header{"Cookie": sc.resp.Header()["Set-Cookie"]}

	sc.req = req

	return sc
}

type scenarioContext struct {
	t                    *testing.T
	cfg                  *setting.Cfg
	m                    *web.Mux
	context              *models.ReqContext
	resp                 *httptest.ResponseRecorder
	handlerFunc          handlerFunc
	defaultHandler       web.Handler
	req                  *http.Request
	url                  string
	userAuthTokenService *auth.FakeUserAuthTokenService
}

func (sc *scenarioContext) exec() {
	sc.m.ServeHTTP(sc.resp, sc.req)
}

type scenarioFunc func(c *scenarioContext)
type handlerFunc func(c *models.ReqContext) response.Response

func getContextHandler(t *testing.T, cfg *setting.Cfg) *contexthandler.ContextHandler {
	t.Helper()

	if cfg == nil {
		cfg = setting.NewCfg()
	}

	sqlStore := sqlstore.InitTestDB(t)
	remoteCacheSvc := &remotecache.RemoteCache{}
	cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{
		Name: "database",
	}
	userAuthTokenSvc := auth.NewFakeUserAuthTokenService()
	renderSvc := &fakeRenderService{}
	authJWTSvc := models.NewFakeJWTService()
	ctxHdlr := contexthandler.ProvideService(cfg, userAuthTokenSvc, authJWTSvc, remoteCacheSvc, renderSvc, sqlStore)

	return ctxHdlr
}

func setupScenarioContext(t *testing.T, url string) *scenarioContext {
	cfg := setting.NewCfg()
	sc := &scenarioContext{
		url: url,
		t:   t,
		cfg: cfg,
	}
	viewsPath, err := filepath.Abs("../../public/views")
	require.NoError(t, err)
	exists, err := fs.Exists(viewsPath)
	require.NoError(t, err)
	require.Truef(t, exists, "Views should be in %q", viewsPath)

	sc.m = web.New()
	sc.m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))
	sc.m.Use(getContextHandler(t, cfg).Middleware)

	return sc
}

type fakeRenderService struct {
	rendering.Service
}

func (s *fakeRenderService) Init() error {
	return nil
}

func setupAccessControlScenarioContext(t *testing.T, cfg *setting.Cfg, url string, permissions []*accesscontrol.Permission) (*scenarioContext, *HTTPServer) {
	cfg.FeatureToggles = make(map[string]bool)
	cfg.FeatureToggles["accesscontrol"] = true
	cfg.Quota.Enabled = false

	bus := bus.GetBus()
	hs := &HTTPServer{
		Cfg:                cfg,
		Bus:                bus,
		Live:               newTestLive(t),
		QuotaService:       &quota.QuotaService{Cfg: cfg},
		RouteRegister:      routing.NewRouteRegister(),
		AccessControl:      accesscontrolmock.New().WithPermissions(permissions),
		searchUsersService: searchusers.ProvideUsersService(bus, filters.ProvideOSSSearchUserFilter()),
	}

	sc := setupScenarioContext(t, url)

	hs.registerRoutes()
	hs.RouteRegister.Register(sc.m.Router)

	return sc, hs
}

type accessControlTestCase struct {
	expectedCode int
	desc         string
	url          string
	method       string
	permissions  []*accesscontrol.Permission
}

// accessControlScenarioContext contains the setups for accesscontrol tests
type accessControlScenarioContext struct {
	// server we registered hs routes on.
	server *web.Mux

	// initCtx is used in a middleware to set the initial context
	// of the request server side. Can be used to pretend sign in.
	initCtx *models.ReqContext

	// hs is a minimal HTTPServer for the accesscontrol tests to pass.
	hs *HTTPServer

	// acmock is an accesscontrol mock used to fake users rights.
	acmock *accesscontrolmock.Mock

	// db is a test database initialized with InitTestDB
	db *sqlstore.SQLStore

	// cfg is the setting provider
	cfg *setting.Cfg
}

func setAccessControlPermissions(acmock *accesscontrolmock.Mock, perms []*accesscontrol.Permission, org int64) {
	acmock.GetUserPermissionsFunc = func(_ context.Context, u *models.SignedInUser) ([]*accesscontrol.Permission, error) {
		if u.OrgId == org {
			return perms, nil
		}
		return nil, nil
	}
}

// setInitCtxSignedInUser sets a copy of the user in initCtx
func setInitCtxSignedInUser(initCtx *models.ReqContext, user models.SignedInUser) {
	initCtx.IsSignedIn = true
	initCtx.SignedInUser = &user
}

func setInitCtxSignedInViewer(initCtx *models.ReqContext) {
	initCtx.IsSignedIn = true
	initCtx.SignedInUser = &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_VIEWER, Login: testUserLogin}
}

func setInitCtxSignedInEditor(initCtx *models.ReqContext) {
	initCtx.IsSignedIn = true
	initCtx.SignedInUser = &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_EDITOR, Login: testUserLogin}
}

func setInitCtxSignedInOrgAdmin(initCtx *models.ReqContext) {
	initCtx.IsSignedIn = true
	initCtx.SignedInUser = &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_ADMIN, Login: testUserLogin}
}

func setupHTTPServer(t *testing.T, useFakeAccessControl bool, enableAccessControl bool) accessControlScenarioContext {
	// Use a new conf
	cfg := setting.NewCfg()
	cfg.FeatureToggles = make(map[string]bool)
	if enableAccessControl {
		cfg.FeatureToggles["accesscontrol"] = enableAccessControl
	}

	return setupHTTPServerWithCfg(t, useFakeAccessControl, enableAccessControl, cfg)
}

func setupHTTPServerWithCfg(t *testing.T, useFakeAccessControl, enableAccessControl bool, cfg *setting.Cfg) accessControlScenarioContext {
	t.Helper()

	var acmock *accesscontrolmock.Mock
	var ac *ossaccesscontrol.OSSAccessControlService

	// Use a test DB
	db := sqlstore.InitTestDB(t)
	db.Cfg = cfg

	bus := bus.GetBus()

	// Create minimal HTTP Server
	hs := &HTTPServer{
		Cfg:                cfg,
		Bus:                bus,
		Live:               newTestLive(t),
		QuotaService:       &quota.QuotaService{Cfg: cfg},
		RouteRegister:      routing.NewRouteRegister(),
		SQLStore:           db,
		searchUsersService: searchusers.ProvideUsersService(bus, filters.ProvideOSSSearchUserFilter()),
	}

	// Defining the accesscontrol service has to be done before registering routes
	if useFakeAccessControl {
		acmock = accesscontrolmock.New()
		if !enableAccessControl {
			acmock = acmock.WithDisabled()
		}
		hs.AccessControl = acmock
	} else {
		ac = ossaccesscontrol.ProvideService(cfg, &usagestats.UsageStatsMock{T: t})
		hs.AccessControl = ac
		// Perform role registration
		err := hs.declareFixedRoles()
		require.NoError(t, err)
		err = ac.RegisterFixedRoles()
		require.NoError(t, err)
	}

	// Instantiate a new Server
	m := web.New()

	// middleware to set the test initial context
	initCtx := &models.ReqContext{}
	m.Use(func(c *web.Context) {
		initCtx.Context = c
		initCtx.Logger = log.New("api-test")
		c.Map(initCtx)
	})

	m.Use(acmiddleware.LoadPermissionsMiddleware(hs.AccessControl))

	// Register all routes
	hs.registerRoutes()
	hs.RouteRegister.Register(m.Router)

	return accessControlScenarioContext{
		server:  m,
		initCtx: initCtx,
		hs:      hs,
		acmock:  acmock,
		db:      db,
		cfg:     cfg,
	}
}

func callAPI(server *web.Mux, method, path string, body io.Reader, t *testing.T) *httptest.ResponseRecorder {
	req, err := http.NewRequest(method, path, body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, req)
	return recorder
}

func mockRequestBody(v interface{}) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(bytes.NewReader(b))
}
