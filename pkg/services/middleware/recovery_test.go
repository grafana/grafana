package middleware

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	macaron "gopkg.in/macaron.v1"
)

func TestRecoveryMiddleware(t *testing.T) {
	// setting.ErrTemplateName = "error-template"
	const apiURL = "/whatever"

	recoveryScenario(t, "Given an API route that panics, recovery middleware should return JSON", apiURL,
		func(t *testing.T, sc *scenarioContext) {
			sc.handlerFunc = panicHandler
			sc.fakeReq("GET", apiURL).exec()
			sc.req.Header.Add("content-type", "application/json")

			assert.Equal(t, 500, sc.resp.Code)
			assert.True(t, strings.HasPrefix(sc.respJson["message"].(string),
				"Internal Server Error - Check the Grafana server logs for the detailed error message."))
			assert.True(t, strings.HasPrefix(sc.respJson["error"].(string), "Server Error"))
		})

	recoveryScenario(t, "Given a non-API route that panics, recovery middleware should return html", apiURL,
		func(t *testing.T, sc *scenarioContext) {
			sc.handlerFunc = panicHandler
			sc.fakeReq("GET", apiURL).exec()

			assert.Equal(t, 500, sc.resp.Code)
			assert.Equal(t, "text/html; charset=UTF-8", sc.resp.Header().Get("content-type"))
			assert.Contains(t, sc.resp.Body.String(), "<title>Grafana - Error</title>")
		})
}

func panicHandler(c *models.ReqContext) {
	panic("Handler has panicked")
}

func recoveryScenario(t *testing.T, desc, url string, fn scenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		var err error
		cfg.LoginMaxLifetime, err = gtime.ParseDuration("30d")
		cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{
			Name:    "database",
			ConnStr: "",
		}

		sqlStore := sqlstore.InitTestDB(t)
		remoteCacheSvc := &remotecache.RemoteCache{}
		userAuthTokenSvc := auth.NewFakeUserAuthTokenService()
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
				Name:     serviceName,
				Instance: svc,
			},
		})
		require.NoError(t, err)

		t.Cleanup(bus.ClearBusHandlers)

		sc := &scenarioContext{
			url:                  url,
			service:              svc,
			m:                    macaron.New(),
			userAuthTokenService: userAuthTokenSvc,
			remoteCacheService:   remoteCacheSvc,
		}

		viewsPath, err := filepath.Abs("../../public/views")
		require.NoError(t, err)

		sc.m.Use(sc.service.Recovery)

		sc.m.Use(sc.service.AddDefaultResponseHeaders)
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(svc.ContextHandler)
		// mock out gc goroutine
		sc.m.Use(svc.OrgRedirect)

		sc.defaultHandler = func(c *models.ReqContext) {
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
			}
		}

		sc.m.Get(url, sc.defaultHandler)

		fn(t, sc)
	})
}
