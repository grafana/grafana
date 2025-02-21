package middleware

import (
	"errors"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestMiddleWareSecurityHeaders(t *testing.T) {
	middlewareScenario(t, "middleware should get correct x-xss-protection header", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "1; mode=block", sc.resp.Header().Get("X-XSS-Protection"))
	}, func(cfg *setting.Cfg) {
		cfg.XSSProtectionHeader = true
	})

	middlewareScenario(t, "middleware should not get x-xss-protection when disabled", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Empty(t, sc.resp.Header().Get("X-XSS-Protection"))
	}, func(cfg *setting.Cfg) {
		cfg.XSSProtectionHeader = false
	})

	middlewareScenario(t, "middleware should add correct Strict-Transport-Security header", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000", sc.resp.Header().Get("Strict-Transport-Security"))
		sc.cfg.StrictTransportSecurityPreload = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000; preload", sc.resp.Header().Get("Strict-Transport-Security"))
		sc.cfg.StrictTransportSecuritySubDomains = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000; preload; includeSubDomains", sc.resp.Header().Get("Strict-Transport-Security"))
	}, func(cfg *setting.Cfg) {
		cfg.StrictTransportSecurity = true
		cfg.StrictTransportSecurityMaxAge = 64000
	})
}

func TestMiddleWareContentSecurityPolicyHeaders(t *testing.T) {
	policy := `script-src 'self' 'strict-dynamic' 'nonce-[^']+';connect-src 'self' ws://localhost:3000/ wss://localhost:3000/;`

	middlewareScenario(t, "middleware should add Content-Security-Policy", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Regexp(t, policy, sc.resp.Header().Get("Content-Security-Policy"))
	}, func(cfg *setting.Cfg) {
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.AppURL = "http://localhost:3000/"
	})

	middlewareScenario(t, "middleware should add Content-Security-Policy-Report-Only", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Regexp(t, policy, sc.resp.Header().Get("Content-Security-Policy-Report-Only"))
	}, func(cfg *setting.Cfg) {
		cfg.CSPReportOnlyEnabled = true
		cfg.CSPReportOnlyTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.AppURL = "http://localhost:3000/"
	})

	middlewareScenario(t, "middleware can add both CSP and CSP-Report-Only", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()

		cspHeader := sc.resp.Header().Get("Content-Security-Policy")
		cspReportOnlyHeader := sc.resp.Header().Get("Content-Security-Policy-Report-Only")

		assert.Regexp(t, policy, cspHeader)
		assert.Regexp(t, policy, cspReportOnlyHeader)

		// assert CSP-Report-Only reuses the same nonce as CSP
		assert.Equal(t, cspHeader, cspReportOnlyHeader)
	}, func(cfg *setting.Cfg) {
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.CSPReportOnlyEnabled = true
		cfg.CSPReportOnlyTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.AppURL = "http://localhost:3000/"
	})
}

func TestMiddlewareContext(t *testing.T) {
	const noStore = "no-store"

	middlewareScenario(t, "middleware should add context to injector", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/").exec()
		assert.NotNil(t, sc.context)
	})

	middlewareScenario(t, "Default middleware should allow get request", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/").exec()
		assert.Equal(t, 200, sc.resp.Code)
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests to API", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should pass cache-control on datasource resources with private cache control", func(t *testing.T, sc *scenarioContext) {
		sc = sc.fakeReq("GET", "/api/datasources/1/resources/foo")
		sc.resp.Header().Add("Cache-Control", "private, max-age=86400")
		sc.resp.Header().Add("X-Grafana-Cache", "true")
		sc.exec()
		assert.Equal(t, "private, max-age=86400", sc.resp.Header().Get("Cache-Control"))
	})

	middlewareScenario(t, "middleware should not pass cache-control on datasource resources with public cache control", func(t *testing.T, sc *scenarioContext) {
		sc = sc.fakeReq("GET", "/api/datasources/1/resources/foo")
		sc.resp.Header().Add("Cache-Control", "public, max-age=86400, private")
		sc.resp.Header().Add("X-Grafana-Cache", "true")
		sc.exec()
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
	})

	middlewareScenario(t, "middleware should pass cache-control on plugins resources with private cache control", func(t *testing.T, sc *scenarioContext) {
		sc = sc.fakeReq("GET", "/api/plugins/1/resources/foo")
		sc.resp.Header().Add("Cache-Control", "private, max-age=86400")
		sc.resp.Header().Add("X-Grafana-Cache", "true")
		sc.exec()
		assert.Equal(t, "private, max-age=86400", sc.resp.Header().Get("Cache-Control"))
	})

	middlewareScenario(t, "middleware should not pass cache-control on plugins resources with public cache control", func(t *testing.T, sc *scenarioContext) {
		sc = sc.fakeReq("GET", "/api/plugins/1/resources/foo")
		sc.resp.Header().Add("Cache-Control", "public, max-age=86400, private")
		sc.resp.Header().Add("X-Grafana-Cache", "true")
		sc.exec()
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
	})

	middlewareScenario(t, "middleware should not add Cache-Control header for requests to datasource proxy API", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/datasources/proxy/1/test").exec()
		assert.Empty(t, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests with HTML response", func(
		t *testing.T, sc *scenarioContext) {
		sc.handlerFunc = func(c *contextmodel.ReqContext) {
			t.Log("Handler called")
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
			t.Log("Calling HTML", "data", data)
			c.HTML(http.StatusOK, "index", data)
			t.Log("Returned HTML with code 200")
		}
		sc.fakeReq("GET", "/").exec()
		require.Equal(t, 200, sc.resp.Code)
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add X-Frame-Options header with deny for request when not allowing embedding", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Equal(t, "deny", sc.resp.Header().Get("X-Frame-Options"))
	})

	middlewareScenario(t, "middleware should not add X-Frame-Options header for request when allowing embedding", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Empty(t, sc.resp.Header().Get("X-Frame-Options"))
	}, func(cfg *setting.Cfg) {
		cfg.AllowEmbedding = true
	})

	middlewareScenario(t, "middleware should add custom response headers", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Regexp(t, "test", sc.resp.Header().Get("X-Custom-Header"))
		assert.Regexp(t, "other-test", sc.resp.Header().Get("X-Other-Header"))
	}, func(cfg *setting.Cfg) {
		cfg.CustomResponseHeaders = map[string]string{
			"X-Custom-Header": "test",
			"X-Other-Header":  "other-test",
		}
	})

	middlewareScenario(t, "middleware should not add Cache-Control header for requests to render pdf", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/reports/render/pdf/").exec()
		assert.Empty(t, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should not add Cache-Control header for requests to render panel as image", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/render/d-solo/").exec()
		assert.Empty(t, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})
}

func middlewareScenario(t *testing.T, desc string, fn scenarioFunc, cbs ...func(*setting.Cfg)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		logger := log.New("test")

		loginMaxLifetime, err := gtime.ParseDuration("30d")
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		cfg.LoginMaxLifetime = loginMaxLifetime
		// Required when rendering errors
		cfg.ErrTemplateName = "error"
		for _, cb := range cbs {
			cb(cfg)
		}

		sc := &scenarioContext{t: t, cfg: cfg}
		viewsPath, err := filepath.Abs("../../public/views")
		require.NoError(t, err)
		exists, err := fs.Exists(viewsPath)
		require.NoError(t, err)
		require.Truef(t, exists, "Views directory should exist at %q", viewsPath)

		sc.m = web.New()
		sc.m.Use(AddCustomResponseHeaders(cfg))
		sc.m.Use(AddDefaultResponseHeaders(cfg))
		sc.m.UseMiddleware(ContentSecurityPolicy(cfg, logger))
		sc.m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))

		// defalut to not authenticated request
		sc.authnService = &authntest.FakeService{ExpectedErr: errors.New("no auth")}
		sc.userService = usertest.NewUserServiceFake()

		ctxHdlr := getContextHandler(t, cfg, sc.authnService)
		sc.m.Use(ctxHdlr.Middleware)
		sc.m.Use(OrgRedirect(sc.cfg, sc.userService))
		// handle action urls
		sc.m.Use(ValidateActionUrl(sc.cfg, logger))

		sc.defaultHandler = func(c *contextmodel.ReqContext) {
			require.NotNil(t, c)
			t.Log("Default HTTP handler called")
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
				if !c.Resp.Written() {
					c.Resp.WriteHeader(http.StatusOK)
				}
			} else {
				t.Log("Returning JSON OK")
				resp := make(map[string]any)
				resp["message"] = "OK"
				c.JSON(http.StatusOK, resp)
			}
		}

		sc.m.Get("/", sc.defaultHandler)

		fn(t, sc)
	})
}

func getContextHandler(t *testing.T, cfg *setting.Cfg, authnService authn.Service) *contexthandler.ContextHandler {
	t.Helper()

	return contexthandler.ProvideService(cfg, authnService, featuremgmt.WithFeatures())
}
