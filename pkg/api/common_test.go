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
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func loggedInUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc, sqlStore sqlstore.Store) {
	loggedInUserScenarioWithRole(t, desc, "GET", url, routePattern, models.ROLE_EDITOR, fn, sqlStore)
}

func loggedInUserScenarioWithRole(t *testing.T, desc string, method string, url string, routePattern string, role models.RoleType, fn scenarioFunc, sqlStore sqlstore.Store) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		sc := setupScenarioContext(t, url)
		sc.sqlStore = sqlStore
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
	req.Header.Add("Content-Type", "application/json")
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

	req.Header.Add("Content-Type", "application/json")

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
	req.Header.Add("Content-Type", "application/json")
	sc.req = req

	return sc
}

func (sc *scenarioContext) fakeReqNoAssertionsWithCookie(method, url string, cookie http.Cookie) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	http.SetCookie(sc.resp, &cookie)

	req, _ := http.NewRequest(method, url, nil)
	req.Header = http.Header{"Cookie": sc.resp.Header()["Set-Cookie"]}
	req.Header.Add("Content-Type", "application/json")
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
	sqlStore             sqlstore.Store
	authInfoService      *logintest.AuthInfoServiceFake
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
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	authProxy := authproxy.ProvideAuthProxy(cfg, remoteCacheSvc, loginservice.LoginServiceMock{}, sqlStore)
	loginService := &logintest.LoginServiceFake{}
	authenticator := &logintest.AuthenticatorFake{}
	ctxHdlr := contexthandler.ProvideService(cfg, userAuthTokenSvc, authJWTSvc, remoteCacheSvc, renderSvc, sqlStore, tracer, authProxy, loginService, authenticator)

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
	cfg.Quota.Enabled = false

	store := sqlstore.InitTestDB(t)
	hs := &HTTPServer{
		Cfg:                cfg,
		Live:               newTestLive(t, store),
		Features:           featuremgmt.WithFeatures(),
		QuotaService:       &quota.QuotaService{Cfg: cfg},
		RouteRegister:      routing.NewRouteRegister(),
		AccessControl:      accesscontrolmock.New().WithPermissions(permissions),
		searchUsersService: searchusers.ProvideUsersService(store, filters.ProvideOSSSearchUserFilter()),
		ldapGroups:         ldap.ProvideGroupsService(),
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
	db sqlstore.Store

	// cfg is the setting provider
	cfg *setting.Cfg

	dashboardsStore dashboards.Store
}

func setAccessControlPermissions(acmock *accesscontrolmock.Mock, perms []*accesscontrol.Permission, org int64) {
	acmock.GetUserPermissionsFunc =
		func(_ context.Context, u *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
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

func setupSimpleHTTPServer(features *featuremgmt.FeatureManager) *HTTPServer {
	if features == nil {
		features = featuremgmt.WithFeatures()
	}
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = features.IsEnabled

	return &HTTPServer{
		Cfg:           cfg,
		Features:      features,
		AccessControl: accesscontrolmock.New().WithDisabled(),
	}
}

func setupHTTPServer(t *testing.T, useFakeAccessControl bool, enableAccessControl bool) accessControlScenarioContext {
	return setupHTTPServerWithCfg(t, useFakeAccessControl, enableAccessControl, setting.NewCfg())
}

func setupHTTPServerWithCfg(t *testing.T, useFakeAccessControl, enableAccessControl bool, cfg *setting.Cfg) accessControlScenarioContext {
	db := sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{})
	return setupHTTPServerWithCfgDb(t, useFakeAccessControl, enableAccessControl, cfg, db, db, featuremgmt.WithFeatures())
}

func setupHTTPServerWithMockDb(t *testing.T, useFakeAccessControl, enableAccessControl bool, features *featuremgmt.FeatureManager) accessControlScenarioContext {
	// Use a new conf
	cfg := setting.NewCfg()
	db := sqlstore.InitTestDB(t)
	db.Cfg = setting.NewCfg()

	return setupHTTPServerWithCfgDb(t, useFakeAccessControl, enableAccessControl, cfg, db, mockstore.NewSQLStoreMock(), features)
}

func setupHTTPServerWithCfgDb(t *testing.T, useFakeAccessControl, enableAccessControl bool, cfg *setting.Cfg, db *sqlstore.SQLStore, store sqlstore.Store, features *featuremgmt.FeatureManager) accessControlScenarioContext {
	t.Helper()

	if enableAccessControl {
		cfg.RBACEnabled = true
		db.Cfg.RBACEnabled = true
	} else {
		cfg.RBACEnabled = false
		db.Cfg.RBACEnabled = false
	}

	var acmock *accesscontrolmock.Mock

	dashboardsStore := dashboardsstore.ProvideDashboardStore(db)

	routeRegister := routing.NewRouteRegister()

	// Create minimal HTTP Server
	hs := &HTTPServer{
		Cfg:                cfg,
		Features:           features,
		Live:               newTestLive(t, db),
		QuotaService:       &quota.QuotaService{Cfg: cfg},
		RouteRegister:      routeRegister,
		SQLStore:           store,
		searchUsersService: searchusers.ProvideUsersService(db, filters.ProvideOSSSearchUserFilter()),
		dashboardService: dashboardservice.ProvideDashboardService(
			cfg, dashboardsStore, nil, features,
			accesscontrolmock.NewMockedPermissionsService(), accesscontrolmock.NewMockedPermissionsService(),
		),
		preferenceService: preftest.NewPreferenceServiceFake(),
	}

	// Defining the accesscontrol service has to be done before registering routes
	if useFakeAccessControl {
		acmock = accesscontrolmock.New()
		if !enableAccessControl {
			acmock = acmock.WithDisabled()
		}
		hs.AccessControl = acmock
		teamPermissionService, err := ossaccesscontrol.ProvideTeamPermissions(cfg, routeRegister, db, acmock, database.ProvideService(db))
		require.NoError(t, err)
		hs.teamPermissionsService = teamPermissionService
	} else {
		ac, errInitAc := ossaccesscontrol.ProvideService(hs.Features, hs.Cfg, database.ProvideService(db), routing.NewRouteRegister())
		require.NoError(t, errInitAc)
		hs.AccessControl = ac
		// Perform role registration
		err := hs.declareFixedRoles()
		require.NoError(t, err)
		err = ac.RegisterFixedRoles(context.Background())
		require.NoError(t, err)
		teamPermissionService, err := ossaccesscontrol.ProvideTeamPermissions(cfg, routeRegister, db, ac, database.ProvideService(db))
		require.NoError(t, err)
		hs.teamPermissionsService = teamPermissionService
	}

	// Instantiate a new Server
	m := web.New()

	// middleware to set the test initial context
	initCtx := &models.ReqContext{}
	m.Use(func(c *web.Context) {
		initCtx.Context = c
		initCtx.Logger = log.New("api-test")
		c.Map(initCtx)

		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), initCtx))
		c.Map(c.Req)
	})

	m.Use(accesscontrol.LoadPermissionsMiddleware(hs.AccessControl))

	// Register all routes
	hs.registerRoutes()
	hs.RouteRegister.Register(m.Router)

	return accessControlScenarioContext{
		server:          m,
		initCtx:         initCtx,
		hs:              hs,
		acmock:          acmock,
		db:              db,
		cfg:             cfg,
		dashboardsStore: dashboardsStore,
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

// APITestServerOption option func for customizing HTTPServer configuration
// when setting up an API test server via SetupAPITestServer.
type APITestServerOption func(hs *HTTPServer)

// SetupAPITestServer sets up a webtest.Server ready for testing all
// routes registered via HTTPServer.registerRoutes().
// Optionally customize HTTPServer configuration by providing APITestServerOption
// option(s).
func SetupAPITestServer(t *testing.T, opts ...APITestServerOption) *webtest.Server {
	t.Helper()

	hs := &HTTPServer{
		RouteRegister:      routing.NewRouteRegister(),
		Cfg:                setting.NewCfg(),
		AccessControl:      accesscontrolmock.New().WithDisabled(),
		Features:           featuremgmt.WithFeatures(),
		searchUsersService: &searchusers.OSSService{},
	}

	for _, opt := range opts {
		opt(hs)
	}

	hs.registerRoutes()
	s := webtest.NewServer(t, hs.RouteRegister)
	return s
}
