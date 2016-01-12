package api

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/Unknwon/macaron"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

func InitApiPluginRoutes(r *macaron.Macaron) {
	for _, plugin := range plugins.ApiPlugins {
		log.Info("Plugin: Adding proxy routes for api plugin")
		for _, route := range plugin.Routes {
			url := util.JoinUrlFragments("/api/plugin-proxy/", route.Path)
			handlers := make([]macaron.Handler, 0)
			if route.ReqSignedIn {
				handlers = append(handlers, middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true}))
			}
			if route.ReqGrafanaAdmin {
				handlers = append(handlers, middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true}))
			}
			if route.ReqSignedIn && route.ReqRole != "" {
				if route.ReqRole == m.ROLE_ADMIN {
					handlers = append(handlers, middleware.RoleAuth(m.ROLE_ADMIN))
				} else if route.ReqRole == m.ROLE_EDITOR {
					handlers = append(handlers, middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN))
				}
			}
			handlers = append(handlers, ApiPlugin(route.Url))
			r.Route(url, route.Method, handlers...)
			log.Info("Plugin: Adding route %s", url)
		}
	}
}

func ApiPlugin(routeUrl string) macaron.Handler {
	return func(c *middleware.Context) {
		path := c.Params("*")

		//Create a HTTP header with the context in it.
		ctx, err := json.Marshal(c.SignedInUser)
		if err != nil {
			c.JsonApiErr(500, "failed to marshal context to json.", err)
			return
		}
		targetUrl, _ := url.Parse(routeUrl)
		proxy := NewApiPluginProxy(string(ctx), path, targetUrl)
		proxy.Transport = dataProxyTransport
		proxy.ServeHTTP(c.RW(), c.Req.Request)
	}
}

func NewApiPluginProxy(ctx string, proxyPath string, targetUrl *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

		req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
		req.Header.Add("Grafana-Context", ctx)
	}

	return &httputil.ReverseProxy{Director: director}
}
