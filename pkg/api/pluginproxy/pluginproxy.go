package pluginproxy

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
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
	appID string, cfg *setting.Cfg, pluginSettingsService pluginsettings.Service,
	secretsService secrets.Service) *httputil.ReverseProxy {
	appProxyLogger := logger.New(
		"userId", ctx.UserId,
		"orgId", ctx.OrgId,
		"uname", ctx.Login,
		"app", appID,
		"path", ctx.Req.URL.Path,
		"remote_addr", ctx.RemoteAddr(),
		"referer", ctx.Req.Referer(),
	)

	director := func(req *http.Request) {
		query := pluginsettings.GetByPluginIDArgs{OrgID: ctx.OrgId, PluginID: appID}
		ps, err := pluginSettingsService.GetPluginSettingByPluginID(ctx.Req.Context(), &query)
		if err != nil {
			ctx.JsonApiErr(500, "Failed to fetch plugin settings", err)
			return
		}

		secureJsonData, err := secretsService.DecryptJsonData(ctx.Req.Context(), ps.SecureJSONData)
		if err != nil {
			ctx.JsonApiErr(500, "Failed to decrypt plugin settings", err)
			return
		}

		data := templateData{
			JsonData:       ps.JSONData,
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
			appProxyLogger.Error("Failed to set plugin route body content", "error", err)
		}
	}

	logAppPluginProxyRequest(appID, cfg, ctx)

	return proxyutil.NewReverseProxy(appProxyLogger, director)
}

func logAppPluginProxyRequest(appID string, cfg *setting.Cfg, c *models.ReqContext) {
	if !cfg.DataProxyLogging {
		return
	}

	var body string
	if c.Req.Body != nil {
		buffer, err := ioutil.ReadAll(c.Req.Body)
		if err == nil {
			c.Req.Body = ioutil.NopCloser(bytes.NewBuffer(buffer))
			body = string(buffer)
		}
	}

	logger.Info("Proxying incoming request",
		"userid", c.UserId,
		"orgid", c.OrgId,
		"username", c.Login,
		"app", appID,
		"uri", c.Req.RequestURI,
		"method", c.Req.Method,
		"body", body)
}
