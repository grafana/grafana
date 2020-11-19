package pluginproxy

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

type templateData struct {
	JsonData       map[string]interface{}
	SecureJsonData map[string]string
}

// NewApiPluginProxy create a plugin proxy
func NewApiPluginProxy(ctx *models.ReqContext, proxyPath string, route *plugins.AppPluginRoute, appID string, cfg *setting.Cfg) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		query := models.GetPluginSettingByIdQuery{OrgId: ctx.OrgId, PluginId: appID}
		if err := bus.Dispatch(&query); err != nil {
			ctx.JsonApiErr(500, "Failed to fetch plugin settings", err)
			return
		}

		data := templateData{
			JsonData:       query.Result.JsonData,
			SecureJsonData: query.Result.SecureJsonData.Decrypt(),
		}

		interpolatedURL, err := interpolateString(route.URL, data)
		if err != nil {
			ctx.JsonApiErr(500, "Could not interpolate plugin route url", err)
			return
		}
		targetURL, err := url.Parse(interpolatedURL)
		if err != nil {
			ctx.JsonApiErr(500, "Could not parse url", err)
			return
		}
		req.URL.Scheme = targetURL.Scheme
		req.URL.Host = targetURL.Host
		req.Host = targetURL.Host
		req.URL.Path = util.JoinURLFragments(targetURL.Path, proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")

		proxyutil.PrepareProxyRequest(req)

		// Create a HTTP header with the context in it.
		ctxJSON, err := json.Marshal(ctx.SignedInUser)
		if err != nil {
			ctx.JsonApiErr(500, "failed to marshal context to json.", err)
			return
		}

		req.Header.Set("X-Grafana-Context", string(ctxJSON))

		applyUserHeader(cfg.SendUserHeader, req, ctx.SignedInUser)

		if err := addHeaders(&req.Header, route, data); err != nil {
			ctx.JsonApiErr(500, "Failed to render plugin headers", err)
			return
		}
	}

	return &httputil.ReverseProxy{Director: director}
}
