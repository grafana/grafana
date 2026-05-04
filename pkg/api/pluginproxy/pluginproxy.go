package pluginproxy

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pluginac "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

type PluginProxy struct {
	accessControl    ac.AccessControl
	ps               *pluginsettings.DTO
	pluginRoutes     []*plugins.Route
	req              *http.Request
	resp             http.ResponseWriter
	signedInUser     identity.Requester
	proxyPath        string
	matchedRoute     *plugins.Route
	dataProxyLogging bool // from cfg
	sendUserHeader   bool // from cfg
	secretsService   secrets.Service
	tracer           tracing.Tracer
	transport        *http.Transport
	features         featuremgmt.FeatureToggles
}

// NewPluginProxy creates a plugin proxy.
func NewPluginProxy(ps *pluginsettings.DTO, routes []*plugins.Route,
	r *http.Request, w http.ResponseWriter, signedInUser identity.Requester,
	proxyPath string,
	dataProxyLogging bool, sendUserHeader bool,
	secretsService secrets.Service, tracer tracing.Tracer,
	transport *http.Transport, accessControl ac.AccessControl, features featuremgmt.FeatureToggles) (*PluginProxy, error) {
	return &PluginProxy{
		accessControl:    accessControl,
		ps:               ps,
		pluginRoutes:     routes,
		req:              r,
		resp:             w,
		signedInUser:     signedInUser,
		proxyPath:        proxyPath,
		sendUserHeader:   dataProxyLogging,
		dataProxyLogging: sendUserHeader,
		secretsService:   secretsService,
		tracer:           tracer,
		transport:        transport,
		features:         features,
	}, nil
}

func (proxy *PluginProxy) HandleRequest() {
	// found route if there are any
	for _, route := range proxy.pluginRoutes {
		// method match
		if route.Method != "" && route.Method != "*" && route.Method != proxy.req.Method {
			continue
		}

		t := web.NewTree()
		t.Add(route.Path, nil)
		_, params, isMatch := t.Match(proxy.proxyPath)

		if !isMatch {
			continue
		}

		if !proxy.hasAccessToRoute(route) {
			writeJSONErr(proxy.resp, proxy.req, http.StatusForbidden, "plugin proxy route access denied", nil)
			return
		}

		if path, exists := params["*"]; exists {
			hasSlash := strings.HasSuffix(proxy.proxyPath, "/")
			proxy.proxyPath = path

			//nolint:staticcheck // not yet migrated to OpenFeature
			if hasSlash && !strings.HasSuffix(path, "/") && proxy.features.IsEnabled(proxy.req.Context(), featuremgmt.FlagPluginProxyPreserveTrailingSlash) {
				proxy.proxyPath += "/"
			}
		} else {
			proxy.proxyPath = ""
		}

		proxy.matchedRoute = route
		break
	}

	if proxy.matchedRoute == nil {
		writeJSONErr(proxy.resp, proxy.req, http.StatusNotFound, "plugin route match not found", nil)
		return
	}

	proxyErrorLogger := logger.New(
		"userId", proxy.signedInUser.GetID(),
		"orgId", proxy.signedInUser.GetOrgID(),
		"uname", proxy.signedInUser.GetLogin(),
		"path", proxy.req.URL.Path,
		"remote_addr", web.RemoteAddr(proxy.req),
		"referer", proxy.req.Referer(),
	)

	reverseProxy := proxyutil.NewReverseProxy(
		proxyErrorLogger,
		proxy.director,
		proxyutil.WithTransport(proxy.transport),
	)

	proxy.logRequest()
	ctx, span := proxy.tracer.Start(proxy.req.Context(), "plugin reverse proxy")
	defer span.End()

	proxy.req = proxy.req.WithContext(ctx)

	span.SetAttributes(
		attribute.String("user", proxy.signedInUser.GetLogin()),
		attribute.Int64("org_id", proxy.signedInUser.GetOrgID()),
	)

	proxy.tracer.Inject(ctx, proxy.req.Header, span)

	reverseProxy.ServeHTTP(proxy.resp, proxy.req)
}

func (proxy *PluginProxy) hasAccessToRoute(route *plugins.Route) bool {
	if route.ReqAction != "" {
		routeEval := pluginac.GetPluginRouteEvaluator(proxy.ps.PluginID, route.ReqAction)
		hasAccess, err := proxy.accessControl.Evaluate(proxy.req.Context(), proxy.signedInUser, routeEval)
		if err != nil {
			logger.FromContext(proxy.req.Context()).Error("Error from access control system", "error", err)
			return false
		}
		if !hasAccess {
			logger.FromContext(proxy.req.Context()).Debug("plugin route is covered by RBAC, user doesn't have access", "route", proxy.req.URL.Path)
		}
		return hasAccess
	}
	if route.ReqRole.IsValid() {
		return proxy.signedInUser.GetOrgRole().Includes(route.ReqRole)
	}
	return true
}

func (proxy PluginProxy) director(req *http.Request) {
	secureJsonData, err := proxy.secretsService.DecryptJsonData(proxy.req.Context(), proxy.ps.SecureJSONData)
	if err != nil {
		writeJSONErr(proxy.resp, proxy.req, 500, "Failed to decrypt plugin settings", err)
		return
	}

	data := templateData{
		JsonData:       proxy.ps.JSONData,
		SecureJsonData: secureJsonData,
	}

	interpolatedURL, err := interpolateString(proxy.matchedRoute.URL, data)
	if err != nil {
		writeJSONErr(proxy.resp, proxy.req, 500, "Could not interpolate plugin route url", err)
		return
	}
	targetURL, err := url.Parse(interpolatedURL)
	if err != nil {
		writeJSONErr(proxy.resp, proxy.req, 500, "Could not parse url", err)
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
	ctxJSON, err := json.Marshal(proxy.signedInUser)
	if err != nil {
		writeJSONErr(proxy.resp, proxy.req, 500, "failed to marshal context to json.", err)
		return
	}

	req.Header.Set("X-Grafana-Context", string(ctxJSON))

	proxyutil.ApplyUserHeader(proxy.sendUserHeader, req, proxy.signedInUser)
	proxyutil.ApplyForwardIDHeader(req, proxy.signedInUser)

	if err := addHeaders(&req.Header, proxy.matchedRoute, data); err != nil {
		writeJSONErr(proxy.resp, proxy.req, 500, "Failed to render plugin headers", err)
		return
	}

	if err := setBodyContent(req, proxy.matchedRoute, data); err != nil {
		logger.FromContext(req.Context()).Error("Failed to set plugin route body content", "error", err)
	}
}

func (proxy PluginProxy) logRequest() {
	if !proxy.dataProxyLogging {
		return
	}

	var body string
	if proxy.req.Body != nil {
		buffer, err := io.ReadAll(proxy.req.Body)
		if err == nil {
			proxy.req.Body = io.NopCloser(bytes.NewBuffer(buffer))
			body = string(buffer)
		}
	}

	ctxLogger := logger.FromContext(proxy.req.Context())
	ctxLogger.Info("Proxying incoming request",
		"userid", proxy.signedInUser.GetID(),
		"orgid", proxy.signedInUser.GetOrgID(),
		"username", proxy.signedInUser.GetLogin(),
		"app", proxy.ps.PluginID,
		"uri", proxy.req.RequestURI,
		"method", proxy.req.Method,
		"body", body)
}

// Equivalent to c.JsonApiErr in /pkg/services/contexthandler/model/model.go#L70
func writeJSONErr(w http.ResponseWriter, r *http.Request, status int, message string, err error) {
	resp := make(map[string]any)
	if err != nil {
		traceID := tracing.TraceIDFromContext(r.Context(), false)
		resp["traceID"] = traceID
		ctxLogger := logger.FromContext(r.Context())
		if status == http.StatusInternalServerError {
			ctxLogger.Error(message, "error", err, "traceID", traceID)
		} else {
			ctxLogger.Warn(message, "error", err, "traceID", traceID)
		}
	}
	switch status {
	case http.StatusNotFound:
		resp["message"] = "Not Found"
	case http.StatusInternalServerError:
		resp["message"] = "Internal Server Error"
	}
	if message != "" {
		resp["message"] = message
	}
	w.Header().Set("Content-Type", "application/json; charset=UTF-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(resp)
}

type templateData struct {
	URL            string
	JsonData       map[string]any
	SecureJsonData map[string]string
}
