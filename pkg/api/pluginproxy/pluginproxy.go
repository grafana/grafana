package pluginproxy

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"go.opentelemetry.io/otel/attribute"
)

var pluginProxyTransport = &http.Transport{
	TLSClientConfig: &tls.Config{
		//InsecureSkipVerify: hs.Cfg.PluginsAppsSkipVerifyTLS,
		Renegotiation: tls.RenegotiateFreelyAsClient,
	},
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSHandshakeTimeout: 10 * time.Second,
}

type PluginProxy struct {
	ps             *pluginsettings.DTO
	pluginRoutes   []*plugins.Route
	ctx            *models.ReqContext
	proxyPath      string
	matchedRoute   *plugins.Route
	cfg            *setting.Cfg
	secretsService secrets.Service
	tracer         tracing.Tracer
}

// NewPluginProxy creates a plugin proxy.
func NewPluginProxy(ps *pluginsettings.DTO, routes []*plugins.Route, ctx *models.ReqContext,
	proxyPath string, cfg *setting.Cfg, secretsService secrets.Service, tracer tracing.Tracer) (*PluginProxy, error) {
	return &PluginProxy{
		ps:             ps,
		pluginRoutes:   routes,
		ctx:            ctx,
		proxyPath:      proxyPath,
		cfg:            cfg,
		secretsService: secretsService,
		tracer:         tracer,
	}, nil
}

func (proxy *PluginProxy) HandleRequest() {
	// found route if there are any
	for _, route := range proxy.pluginRoutes {
		// method match
		if route.Method != "" && route.Method != "*" && route.Method != proxy.ctx.Req.Method {
			continue
		}

		// route match
		if !strings.HasPrefix(proxy.proxyPath, route.Path) {
			continue
		}

		if route.ReqRole.IsValid() {
			if !proxy.ctx.HasUserRole(route.ReqRole) {
				proxy.ctx.JsonApiErr(http.StatusForbidden, "plugin proxy route access denied", nil)
				return
			}
		}

		proxy.matchedRoute = route
	}

	if proxy.matchedRoute == nil {
		proxy.ctx.JsonApiErr(http.StatusNotFound, "plugin route match not found", nil)
		return
	}

	traceID := tracing.TraceIDFromContext(proxy.ctx.Req.Context(), false)
	proxyErrorLogger := logger.New(
		"userId", proxy.ctx.UserId,
		"orgId", proxy.ctx.OrgId,
		"uname", proxy.ctx.Login,
		"path", proxy.ctx.Req.URL.Path,
		"remote_addr", proxy.ctx.RemoteAddr(),
		"referer", proxy.ctx.Req.Referer(),
		"traceID", traceID,
	)

	reverseProxy := proxyutil.NewReverseProxy(
		proxyErrorLogger,
		proxy.director,
		proxyutil.WithTransport(pluginProxyTransport),
	)

	proxy.logRequest()
	ctx, span := proxy.tracer.Start(proxy.ctx.Req.Context(), "datasource reverse proxy")
	defer span.End()

	proxy.ctx.Req = proxy.ctx.Req.WithContext(ctx)

	span.SetAttributes("user", proxy.ctx.SignedInUser.Login, attribute.Key("user").String(proxy.ctx.SignedInUser.Login))
	span.SetAttributes("org_id", proxy.ctx.SignedInUser.OrgId, attribute.Key("org_id").Int64(proxy.ctx.SignedInUser.OrgId))

	proxy.tracer.Inject(ctx, proxy.ctx.Req.Header, span)

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req)
}

func (proxy PluginProxy) director(req *http.Request) {
	secureJsonData, err := proxy.secretsService.DecryptJsonData(proxy.ctx.Req.Context(), proxy.ps.SecureJSONData)
	if err != nil {
		proxy.ctx.JsonApiErr(500, "Failed to decrypt plugin settings", err)
		return
	}

	data := templateData{
		JsonData:       proxy.ps.JSONData,
		SecureJsonData: secureJsonData,
	}

	interpolatedURL, err := interpolateString(proxy.matchedRoute.URL, data)
	if err != nil {
		proxy.ctx.JsonApiErr(500, "Could not interpolate plugin route url", err)
		return
	}
	targetURL, err := url.Parse(interpolatedURL)
	if err != nil {
		proxy.ctx.JsonApiErr(500, "Could not parse url", err)
		return
	}
	req.URL.Scheme = targetURL.Scheme
	req.URL.Host = targetURL.Host
	req.Host = targetURL.Host
	req.URL.Path = util.JoinURLFragments(targetURL.Path, proxy.proxyPath)

	// clear cookie headers
	req.Header.Del("Cookie")
	req.Header.Del("Set-Cookie")

	// Create a HTTP header with the context in it.
	ctxJSON, err := json.Marshal(proxy.ctx.SignedInUser)
	if err != nil {
		proxy.ctx.JsonApiErr(500, "failed to marshal context to json.", err)
		return
	}

	req.Header.Set("X-Grafana-Context", string(ctxJSON))

	applyUserHeader(proxy.cfg.SendUserHeader, req, proxy.ctx.SignedInUser)

	if err := addHeaders(&req.Header, proxy.matchedRoute, data); err != nil {
		proxy.ctx.JsonApiErr(500, "Failed to render plugin headers", err)
		return
	}

	if err := setBodyContent(req, proxy.matchedRoute, data); err != nil {
		logger.Error("Failed to set plugin route body content", "error", err)
	}
}

func (proxy PluginProxy) logRequest() {
	if !proxy.cfg.DataProxyLogging {
		return
	}

	var body string
	if proxy.ctx.Req.Body != nil {
		buffer, err := ioutil.ReadAll(proxy.ctx.Req.Body)
		if err == nil {
			proxy.ctx.Req.Body = ioutil.NopCloser(bytes.NewBuffer(buffer))
			body = string(buffer)
		}
	}

	logger.Info("Proxying incoming request",
		"userid", proxy.ctx.UserId,
		"orgid", proxy.ctx.OrgId,
		"username", proxy.ctx.Login,
		"app", proxy.ps.PluginID,
		"uri", proxy.ctx.Req.RequestURI,
		"method", proxy.ctx.Req.Method,
		"body", body)
}

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
