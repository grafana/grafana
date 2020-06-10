package pluginproxy

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
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

func getHeaders(route *plugins.AppPluginRoute, orgId int64, appID string) (http.Header, error) {
	result := http.Header{}

	query := models.GetPluginSettingByIdQuery{OrgId: orgId, PluginId: appID}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	data := templateData{
		JsonData:       query.Result.JsonData,
		SecureJsonData: query.Result.SecureJsonData.Decrypt(),
	}

	err := addHeaders(&result, route, data)
	return result, err
}

func updateURL(route *plugins.AppPluginRoute, orgId int64, appID string) (string, error) {
	query := models.GetPluginSettingByIdQuery{OrgId: orgId, PluginId: appID}
	if err := bus.Dispatch(&query); err != nil {
		return "", err
	}

	data := templateData{
		JsonData:       query.Result.JsonData,
		SecureJsonData: query.Result.SecureJsonData.Decrypt(),
	}
	interpolated, err := InterpolateString(route.URL, data)
	if err != nil {
		return "", err
	}
	return interpolated, err
}

// NewApiPluginProxy create a plugin proxy
func NewApiPluginProxy(ctx *models.ReqContext, proxyPath string, route *plugins.AppPluginRoute, appID string, cfg *setting.Cfg) *httputil.ReverseProxy {
	targetURL, _ := url.Parse(route.URL)

	director := func(req *http.Request) {

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

		if len(route.Headers) > 0 {
			headers, err := getHeaders(route, ctx.OrgId, appID)
			if err != nil {
				ctx.JsonApiErr(500, "Could not generate plugin route header", err)
				return
			}

			for key, value := range headers {
				log.Trace("setting key %v value <redacted>", key)
				req.Header.Set(key, value[0])
			}
		}

		if len(route.URL) > 0 {
			interpolatedURL, err := updateURL(route, ctx.OrgId, appID)
			if err != nil {
				ctx.JsonApiErr(500, "Could not interpolate plugin route url", err)
			}
			targetURL, err := url.Parse(interpolatedURL)
			if err != nil {
				ctx.JsonApiErr(500, "Could not parse custom url: %v", err)
				return
			}
			req.URL.Scheme = targetURL.Scheme
			req.URL.Host = targetURL.Host
			req.Host = targetURL.Host
			req.URL.Path = util.JoinURLFragments(targetURL.Path, proxyPath)
		}

		// reqBytes, _ := httputil.DumpRequestOut(req, true);
		// log.Trace("Proxying plugin request: %s", string(reqBytes))
	}

	return &httputil.ReverseProxy{Director: director}
}
