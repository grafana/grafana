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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func loggedInUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc, sqlStore db.DB) {
	loggedInUserScenarioWithRole(t, desc, "GET", url, routePattern, org.RoleEditor, fn, sqlStore)
}

func loggedInUserScenarioWithRole(t *testing.T, desc string, method string, url string, routePattern string, role org.RoleType, fn scenarioFunc, sqlStore db.DB) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		sc := setupScenarioContext(t, url)
		sc.sqlStore = sqlStore
		sc.userService = usertest.NewUserServiceFake()
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.Login = testUserLogin
			sc.context.OrgRole = role
			sc.context.IsAnonymous = false
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
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
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
	t                       *testing.T
	settingsProvider        setting.SettingsProvider
	m                       *web.Mux
	context                 *contextmodel.ReqContext
	resp                    *httptest.ResponseRecorder
	handlerFunc             handlerFunc
	defaultHandler          web.Handler
	req                     *http.Request
	url                     string
	userAuthTokenService    *authtest.FakeUserAuthTokenService
	sqlStore                db.DB
	authInfoService         *authinfotest.FakeService
	dashboardVersionService dashver.Service
	userService             user.Service
	ctxHdlr                 *contexthandler.ContextHandler
}

func (sc *scenarioContext) exec() {
	sc.m.ServeHTTP(sc.resp, sc.req)
}

type (
	scenarioFunc func(c *scenarioContext)
	handlerFunc  func(c *contextmodel.ReqContext) response.Response
)

func getContextHandler(t *testing.T, cfg *setting.Cfg) *contexthandler.ContextHandler {
	t.Helper()

	if cfg == nil {
		cfg = setting.NewCfg()
	}

	return contexthandler.ProvideService(
		cfg,
		&authntest.FakeService{ExpectedIdentity: &authn.Identity{ID: "0", Type: claims.TypeAnonymous, SessionToken: &usertoken.UserToken{}}},
		featuremgmt.WithFeatures(),
	)
}

func setupScenarioContext(t *testing.T, url string) *scenarioContext {
	settingsProvider := setting.ProvideService(setting.NewCfg())
	cfg := settingsProvider.Get()
	ctxHdlr := getContextHandler(t, cfg)
	sc := &scenarioContext{
		url:              url,
		t:                t,
		settingsProvider: settingsProvider,
		ctxHdlr:          ctxHdlr,
	}
	viewsPath, err := filepath.Abs("../../public/views")
	require.NoError(t, err)
	exists, err := fs.Exists(viewsPath)
	require.NoError(t, err)
	require.Truef(t, exists, "Views should be in %q", viewsPath)

	sc.m = web.New()
	sc.m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))
	sc.m.Use(ctxHdlr.Middleware)

	return sc
}

func setupScenarioContextSamlLogout(t *testing.T, url string) *scenarioContext {
	cfg := setting.NewCfg()
	// seed sections and keys
	cfg.Raw.DeleteSection("DEFAULT")
	saml, err := cfg.Raw.NewSection("auth.saml")
	assert.NoError(t, err)
	_, err = saml.NewKey("enabled", "true")
	assert.NoError(t, err)
	_, err = saml.NewKey("allow_idp_initiated", "false")
	assert.NoError(t, err)
	_, err = saml.NewKey("single_logout", "true")
	assert.NoError(t, err)

	ctxHdlr := getContextHandler(t, cfg)
	sc := &scenarioContext{
		url:              url,
		t:                t,
		settingsProvider: setting.ProvideService(cfg),
		ctxHdlr:          ctxHdlr,
	}
	viewsPath, err := filepath.Abs("../../public/views")
	require.NoError(t, err)
	exists, err := fs.Exists(viewsPath)
	require.NoError(t, err)
	require.Truef(t, exists, "Views should be in %q", viewsPath)

	sc.m = web.New()
	sc.m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))
	sc.m.Use(ctxHdlr.Middleware)

	return sc
}

// FIXME: This user should not be anonymous
func authedUserWithPermissions(userID, orgID int64, permissions []accesscontrol.Permission) *user.SignedInUser {
	return &user.SignedInUser{UserID: userID, OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), permissions)}}
}

// FIXME: This user should not be anonymous
func userWithPermissions(orgID int64, permissions []accesscontrol.Permission) *user.SignedInUser {
	return &user.SignedInUser{IsAnonymous: true, OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), permissions)}}
}

func setupSimpleHTTPServer(features featuremgmt.FeatureToggles) *HTTPServer {
	if features == nil {
		features = featuremgmt.WithFeatures()
	}
	// nolint:staticcheck
	cfg := setting.NewCfgWithFeatures(features.IsEnabledGlobally)

	return &HTTPServer{
		Cfg:             setting.ProvideService(cfg),
		Features:        features,
		License:         &licensing.OSSLicensingService{},
		AccessControl:   acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		annotationsRepo: annotationstest.NewFakeAnnotationsRepo(),
		authInfoService: &authinfotest.FakeService{
			ExpectedLabels: map[int64]string{int64(1): login.GetAuthProviderLabel(login.LDAPAuthModule)},
		},
		tracer: tracing.InitializeTracerForTest(),
	}
}

func mockRequestBody(v any) io.ReadCloser {
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
		License:            &licensing.OSSLicensingService{},
		Features:           featuremgmt.WithFeatures(),
		QuotaService:       quotatest.New(false, nil),
		searchUsersService: &searchusers.OSSService{},
		tracer:             tracing.InitializeTracerForTest(),
	}

	for _, opt := range opts {
		opt(hs)
	}

	if hs.Cfg == nil {
		hs.Cfg = setting.ProvideService(setting.NewCfg())
	}

	if hs.AccessControl == nil {
		hs.AccessControl = acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	}

	hs.registerRoutes()

	s := webtest.NewServer(t, hs.RouteRegister)

	viewsPath, err := filepath.Abs("../../public/views")
	require.NoError(t, err)
	s.Mux.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))

	return s
}

type mockSearchService struct{ ExpectedResult model.HitList }

func (mss *mockSearchService) SearchHandler(_ context.Context, q *search.Query) (model.HitList, error) {
	return mss.ExpectedResult, nil
}

func (mss *mockSearchService) SortOptions() []model.SortOption { return nil }
