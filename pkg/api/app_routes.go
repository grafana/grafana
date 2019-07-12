package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
	macaron "gopkg.in/macaron.v1"
)

var pluginProxyTransport *http.Transport

func (hs *HTTPServer) initAppPluginRoutes(r *macaron.Macaron) {
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

	for _, plugin := range plugins.Apps {
		for _, route := range plugin.Routes {
			url := util.JoinURLFragments("/api/plugin-proxy/"+plugin.Id, route.Path)
			handlers := make([]macaron.Handler, 0)
			handlers = append(handlers, middleware.Auth(&middleware.AuthOptions{
				ReqSignedIn: true,
			}))

			if route.ReqRole != "" {
				if route.ReqRole == m.ROLE_ADMIN {
					handlers = append(handlers, middleware.RoleAuth(m.ROLE_ADMIN))
				} else if route.ReqRole == m.ROLE_EDITOR {
					handlers = append(handlers, middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN))
				}
			}
			handlers = append(handlers, AppPluginRoute(route, plugin.Id, hs))
			r.Route(url, route.Method, handlers...)
			log.Debug("Plugins: Adding proxy route %s", url)
		}
	}
}

func AppPluginRoute(route *plugins.AppPluginRoute, appID string, hs *HTTPServer) macaron.Handler {
	return func(c *m.ReqContext) {
		path := c.Params("*")

		proxy := pluginproxy.NewApiPluginProxy(c, path, route, appID, hs.Cfg)
		proxy.Transport = pluginProxyTransport
		proxy.ServeHTTP(c.Resp, c.Req.Request)
	}
}
