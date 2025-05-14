package pluginproxy

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pluginac "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

type PluginProxy struct {
	accessControl  ac.AccessControl
	ps             *pluginsettings.DTO
	pluginRoutes   []*plugins.Route
	ctx            *contextmodel.ReqContext
	proxyPath      string
	matchedRoute   *plugins.Route
	cfg            *setting.Cfg
	secretsService secrets.Service
	tracer         tracing.Tracer
	transport      *http.Transport
	features       featuremgmt.FeatureToggles
}

// NewPluginProxy creates a plugin proxy.
func NewPluginProxy(ps *pluginsettings.DTO, routes []*plugins.Route, ctx *contextmodel.ReqContext,
	proxyPath string, cfg *setting.Cfg, secretsService secrets.Service, tracer tracing.Tracer,
	transport *http.Transport, accessControl ac.AccessControl, features featuremgmt.FeatureToggles) (*PluginProxy, error) {
	return &PluginProxy{
		accessControl:  accessControl,
		ps:             ps,
		pluginRoutes:   routes,
		ctx:            ctx,
		proxyPath:      proxyPath,
		cfg:            cfg,
		secretsService: secretsService,
		tracer:         tracer,
		transport:      transport,
		features:       features,
	}, nil
}

func (proxy *PluginProxy) HandleRequest() {
	// found route if there are any
	for _, route := range proxy.pluginRoutes {
		// method match
		if route.Method != "" && route.Method != "*" && route.Method != proxy.ctx.Req.Method {
			continue
		}

		t := web.NewTree()
		t.Add(route.Path, nil)
		_, params, isMatch := t.Match(proxy.proxyPath)

		if !isMatch {
			continue
		}

		if !proxy.hasAccessToRoute(route) {
			proxy.ctx.JsonApiErr(http.StatusForbidden, "plugin proxy route access denied", nil)
			return
		}

		if path, exists := params["*"]; exists {
			hasSlash := strings.HasSuffix(proxy.proxyPath, "/")
			proxy.proxyPath = path

			if hasSlash && !strings.HasSuffix(path, "/") && proxy.features.IsEnabled(proxy.ctx.Req.Context(), featuremgmt.FlagPluginProxyPreserveTrailingSlash) {
				proxy.proxyPath += "/"
			}
		} else {
			proxy.proxyPath = ""
		}

		proxy.matchedRoute = route
		break
	}

	if proxy.matchedRoute == nil {
		proxy.ctx.JsonApiErr(http.StatusNotFound, "plugin route match not found", nil)
		return
	}

	proxyErrorLogger := logger.New(
		"userId", proxy.ctx.UserID,
		"orgId", proxy.ctx.OrgID,
		"uname", proxy.ctx.Login,
		"path", proxy.ctx.Req.URL.Path,
		"remote_addr", proxy.ctx.RemoteAddr(),
		"referer", proxy.ctx.Req.Referer(),
	)

	reverseProxy := proxyutil.NewReverseProxy(
		proxyErrorLogger,
		proxy.director,
		proxyutil.WithTransport(proxy.transport),
	)

	proxy.logRequest()
	ctx, span := proxy.tracer.Start(proxy.ctx.Req.Context(), "plugin reverse proxy")
	defer span.End()

	proxy.ctx.Req = proxy.ctx.Req.WithContext(ctx)

	span.SetAttributes(
		attribute.String("user", proxy.ctx.SignedInUser.Login),
		attribute.Int64("org_id", proxy.ctx.SignedInUser.OrgID),
	)

	proxy.tracer.Inject(ctx, proxy.ctx.Req.Header, span)

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req)
}

func (proxy *PluginProxy) hasAccessToRoute(route *plugins.Route) bool {
	if route.ReqAction != "" {
		routeEval := pluginac.GetPluginRouteEvaluator(proxy.ps.PluginID, route.ReqAction)
		hasAccess := ac.HasAccess(proxy.accessControl, proxy.ctx)(routeEval)
		if !hasAccess {
			proxy.ctx.Logger.Debug("plugin route is covered by RBAC, user doesn't have access", "route", proxy.ctx.Req.URL.Path)
		}
		return hasAccess
	}
	if route.ReqRole.IsValid() {
		return proxy.ctx.HasUserRole(route.ReqRole)
	}
	return true
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

	proxyutil.ApplyUserHeader(proxy.cfg.SendUserHeader, req, proxy.ctx.SignedInUser)
	proxyutil.ApplyForwardIDHeader(req, proxy.ctx.SignedInUser)

	if err := addHeaders(&req.Header, proxy.matchedRoute, data); err != nil {
		proxy.ctx.JsonApiErr(500, "Failed to render plugin headers", err)
		return
	}

	if err := setBodyContent(req, proxy.matchedRoute, data); err != nil {
		logger.FromContext(req.Context()).Error("Failed to set plugin route body content", "error", err)
	}
}

func (proxy PluginProxy) logRequest() {
	if !proxy.cfg.DataProxyLogging {
		return
	}

	var body string
	if proxy.ctx.Req.Body != nil {
		buffer, err := io.ReadAll(proxy.ctx.Req.Body)
		if err == nil {
			proxy.ctx.Req.Body = io.NopCloser(bytes.NewBuffer(buffer))
			body = string(buffer)
		}
	}

	ctxLogger := logger.FromContext(proxy.ctx.Req.Context())
	ctxLogger.Info("Proxying incoming request",
		"userid", proxy.ctx.UserID,
		"orgid", proxy.ctx.OrgID,
		"username", proxy.ctx.Login,
		"app", proxy.ps.PluginID,
		"uri", proxy.ctx.Req.RequestURI,
		"method", proxy.ctx.Req.Method,
		"body", body)
}

type templateData struct {
	URL            string
	JsonData       map[string]any
	SecureJsonData map[string]string
}
