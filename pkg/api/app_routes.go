package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var pluginProxyTransport *http.Transport
var applog = log.New("app.routes")

func (hs *HTTPServer) initAppPluginRoutes(r *web.Mux) {
	pluginProxyTransport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: hs.Cfg.PluginsAppsSkipVerifyTLS,
			Renegotiation:      tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	for _, plugin := range hs.pluginStore.Plugins(plugins.App) {
		for _, route := range plugin.Routes {
			url := util.JoinURLFragments("/api/plugin-proxy/"+plugin.ID, route.Path)
			handlers := make([]web.Handler, 0)
			handlers = append(handlers, middleware.Auth(&middleware.AuthOptions{
				ReqSignedIn: true,
			}))

			if route.ReqRole != "" {
				if route.ReqRole == models.ROLE_ADMIN {
					handlers = append(handlers, middleware.RoleAuth(models.ROLE_ADMIN))
				} else if route.ReqRole == models.ROLE_EDITOR {
					handlers = append(handlers, middleware.RoleAuth(models.ROLE_EDITOR, models.ROLE_ADMIN))
				}
			}
			handlers = append(handlers, AppPluginRoute(route, plugin.ID, hs))
			for _, method := range strings.Split(route.Method, ",") {
				r.Handle(strings.TrimSpace(method), url, handlers)
			}

			applog.Debug("Plugins: Adding proxy route", "url", url)
		}
	}
}

func AppPluginRoute(route *plugins.Route, appID string, hs *HTTPServer) web.Handler {
	return func(c *models.ReqContext) {
		path := web.Params(c.Req)["*"]

		proxy := pluginproxy.NewApiPluginProxy(c, path, route, appID, hs.Cfg, hs.SecretsService)
		proxy.Transport = pluginProxyTransport
		proxy.ServeHTTP(c.Resp, c.Req)
	}
}
