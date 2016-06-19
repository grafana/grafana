package api

import (
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

func InitAppPluginRoutes(r *macaron.Macaron) {
	for _, plugin := range plugins.Apps {
		for _, route := range plugin.Routes {
			url := util.JoinUrlFragments("/api/plugin-proxy/"+plugin.Id, route.Path)
			handlers := make([]macaron.Handler, 0)
			handlers = append(handlers, middleware.Auth(&middleware.AuthOptions{
				ReqSignedIn:     true,
				ReqGrafanaAdmin: route.ReqGrafanaAdmin,
			}))

			if route.ReqRole != "" {
				if route.ReqRole == m.ROLE_ADMIN {
					handlers = append(handlers, middleware.RoleAuth(m.ROLE_ADMIN))
				} else if route.ReqRole == m.ROLE_EDITOR {
					handlers = append(handlers, middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN))
				}
			}
			handlers = append(handlers, AppPluginRoute(route, plugin.Id))
			r.Route(url, route.Method, handlers...)
			log.Debug("Plugins: Adding proxy route %s", url)
		}
	}
}

func AppPluginRoute(route *plugins.AppPluginRoute, appId string) macaron.Handler {
	return func(c *middleware.Context) {
		path := c.Params("*")

		proxy := pluginproxy.NewApiPluginProxy(c, path, route, appId)
		proxy.Transport = dataProxyTransport
		proxy.ServeHTTP(c.Resp, c.Req.Request)
	}
}
