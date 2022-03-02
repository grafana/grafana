package pluginproxy

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

type templateData struct {
	JsonData       map[string]interface{}
	SecureJsonData map[string]string
}

// NewApiPluginProxy create a plugin proxy
func NewApiPluginProxy(ctx *models.ReqContext, proxyPath string, route *plugins.Route,
	appID string, cfg *setting.Cfg, store pluginsettings.Service, secretsService secrets.Service) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		query := models.GetPluginSettingByIdQuery{OrgId: ctx.OrgId, PluginId: appID}
		if err := store.GetPluginSettingById(ctx.Req.Context(), &query); err != nil {
			ctx.JsonApiErr(500, "Failed to fetch plugin settings", err)
			return
		}

		secureJsonData, err := secretsService.DecryptJsonData(ctx.Req.Context(), query.Result.SecureJsonData)
		if err != nil {
			ctx.JsonApiErr(500, "Failed to decrypt plugin settings", err)
			return
		}

		data := templateData{
			JsonData:       query.Result.JsonData,
			SecureJsonData: secureJsonData,
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

		if err := setBodyContent(req, route, data); err != nil {
			logger.Error("Failed to set plugin route body content", "error", err)
		}
	}

	return &httputil.ReverseProxy{Director: director, ModifyResponse: modifyResponse}
}

func modifyResponse(resp *http.Response) error {
	proxyutil.SetProxyResponseHeaders(resp.Header)

	return nil
}
