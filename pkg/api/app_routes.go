package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"text/template"

	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

func InitAppPluginRoutes(r *macaron.Macaron) {
	for _, plugin := range plugins.Apps {
		for _, route := range plugin.Routes {
			log.Info("Plugin: Adding proxy route for app plugin")
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
			handlers = append(handlers, AppPluginRoute(route, plugin.Id))
			r.Route(url, route.Method, handlers...)
			log.Info("Plugin: Adding route %s", url)
		}
	}
}

func AppPluginRoute(route *plugins.AppPluginRoute, appId string) macaron.Handler {
	return func(c *middleware.Context) {
		path := c.Params("*")

		proxy := NewApiPluginProxy(c, path, route, appId)
		proxy.Transport = dataProxyTransport
		proxy.ServeHTTP(c.Resp, c.Req.Request)
	}
}

func NewApiPluginProxy(ctx *middleware.Context, proxyPath string, route *plugins.AppPluginRoute, appId string) *httputil.ReverseProxy {
	targetUrl, _ := url.Parse(route.Url)

	director := func(req *http.Request) {

		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

		req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")

		//Create a HTTP header with the context in it.
		ctxJson, err := json.Marshal(ctx.SignedInUser)
		if err != nil {
			ctx.JsonApiErr(500, "failed to marshal context to json.", err)
			return
		}

		req.Header.Add("Grafana-Context", string(ctxJson))
		// add custom headers defined in the plugin config.
		for _, header := range route.Headers {
			var contentBuf bytes.Buffer
			t, err := template.New("content").Parse(header.Content)
			if err != nil {
				ctx.JsonApiErr(500, fmt.Sprintf("could not parse header content template for header %s.", header.Name), err)
				return
			}

			//lookup appSettings
			query := m.GetAppSettingByAppIdQuery{OrgId: ctx.OrgId, AppId: appId}

			if err := bus.Dispatch(&query); err != nil {
				ctx.JsonApiErr(500, "failed to get AppSettings.", err)
				return
			}
			type templateData struct {
				JsonData       map[string]interface{}
				SecureJsonData map[string]string
			}
			data := templateData{
				JsonData:       query.Result.JsonData,
				SecureJsonData: query.Result.SecureJsonData.Decrypt(),
			}
			err = t.Execute(&contentBuf, data)
			if err != nil {
				ctx.JsonApiErr(500, fmt.Sprintf("failed to execute header content template for header %s.", header.Name), err)
				return
			}
			log.Debug("Adding header to proxy request. %s: %s", header.Name, contentBuf.String())
			req.Header.Add(header.Name, contentBuf.String())
		}
	}

	return &httputil.ReverseProxy{Director: director}
}
