package pluginproxy

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/api/datasource/validation"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourcesV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	pluginac "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

var (
	logger = glog.New("data-proxy-log")
	client = newHTTPClient()

	errPluginProxyRouteAccessDenied = errors.New("plugin proxy route access denied")
)

// maxForwardedUserAgentLen is the maximum byte length of the client User-Agent
// appended to the data proxy User-Agent when forward_user_agent is enabled.
const maxForwardedUserAgentLen = 255

type HTTPContext struct {
	Req  *http.Request
	Resp http.ResponseWriter

	// TODO? eventually this should come from the user in the request context
	UserToken *usertoken.UserToken
}

type DataSourceProxy struct {
	ds                *datasourcesV0.DataSource
	requester         identity.Requester
	dataSource        DataSourceLoader
	ctx               HTTPContext
	targetUrl         *url.URL
	proxyPath         string
	matchedRoute      *plugins.Route
	pluginRoutes      []*plugins.Route
	settings          *DataSourceProxySettings
	clientProvider    httpclient.Provider
	oAuthTokenService oauthtoken.OAuthTokenService
	tracer            tracing.Tracer
	features          featuremgmt.FeatureToggles
}

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// NewDataSourceProxy creates a new Datasource proxy
func NewDataSourceProxy(dataSource DataSourceLoader,
	pluginRoutes []*plugins.Route, ctx HTTPContext,
	proxyPath string, settings *DataSourceProxySettings, clientProvider httpclient.Provider,
	oAuthTokenService oauthtoken.OAuthTokenService,
	tracer tracing.Tracer, features featuremgmt.FeatureToggles,
) (*DataSourceProxy, error) {
	ds, err := dataSource.DataSource(ctx.Req.Context())
	if err != nil {
		return nil, fmt.Errorf("failed to load datasource: %w", err)
	}

	targetURL, err := validation.ValidateURL(dataSource.PluginType(), ds.Spec.URL())
	if err != nil {
		return nil, err
	}

	requester, err := identity.GetRequester(ctx.Req.Context())
	if err != nil {
		return nil, fmt.Errorf("failed to get requester from context: %w", err)
	}

	return &DataSourceProxy{
		ds:                ds,
		requester:         requester,
		dataSource:        dataSource,
		pluginRoutes:      pluginRoutes,
		ctx:               ctx,
		proxyPath:         proxyPath,
		targetUrl:         targetURL,
		settings:          settings,
		clientProvider:    clientProvider,
		oAuthTokenService: oAuthTokenService,
		tracer:            tracer,
		features:          features,
	}, nil
}

func newHTTPClient() httpClient {
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
	}
}

func (proxy *DataSourceProxy) HandleRequest() {
	if err := proxy.validateRequest(); err != nil {
		writeJSONErr(proxy.ctx.Resp, proxy.ctx.Req, 403, err.Error(), nil)
		return
	}

	userid, _ := proxy.requester.GetInternalID()
	proxyErrorLogger := logger.New(
		"userId", userid,
		"orgId", proxy.requester.GetOrgID(),
		"uname", proxy.requester.GetLogin(),
		"path", proxy.ctx.Req.URL.Path,
		"remote_addr", proxy.ctx.Req.RemoteAddr,
		"referer", proxy.ctx.Req.Referer(),
	)

	transport, err := proxy.dataSource.GetHTTPTransport(proxy.ctx.Req.Context(), proxy.clientProvider)
	if err != nil {
		writeJSONErr(proxy.ctx.Resp, proxy.ctx.Req, 400, "Unable to load TLS certificate", err)
		return
	}

	modifyResponse := func(resp *http.Response) error {
		if resp.StatusCode == 401 {
			// The data source rejected the request as unauthorized, convert to 400 (bad request)
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return fmt.Errorf("failed to read data source response body: %w", err)
			}
			_ = resp.Body.Close()

			ctxLogger := proxyErrorLogger.FromContext(resp.Request.Context())
			ctxLogger.Info("Authentication to data source failed", "body", string(body), "statusCode",
				resp.StatusCode)
			msg := "Authentication to data source failed"
			*resp = http.Response{
				StatusCode:    400,
				Status:        "Bad Request",
				Body:          io.NopCloser(strings.NewReader(msg)),
				ContentLength: int64(len(msg)),
				Header:        http.Header{},
				Request:       resp.Request,
			}
		}
		return nil
	}

	reverseProxy := proxyutil.NewReverseProxy(
		proxyErrorLogger,
		proxy.director,
		proxyutil.WithTransport(transport),
		proxyutil.WithModifyResponse(modifyResponse),
	)

	proxy.logRequest()
	ctx, span := proxy.tracer.Start(proxy.ctx.Req.Context(), "datasource reverse proxy")
	defer span.End()

	proxy.ctx.Req = proxy.ctx.Req.WithContext(ctx)

	span.SetAttributes(
		attribute.String("datasource_name", proxy.ds.Spec.Title()),
		attribute.String("datasource_type", proxy.dataSource.PluginType()),
		attribute.String("user", proxy.requester.GetLogin()),
		attribute.Int64("org_id", proxy.requester.GetOrgID()),
	)

	proxy.addTraceFromHeaderValue(span, "X-Panel-Id", "panel_id")
	proxy.addTraceFromHeaderValue(span, "X-Dashboard-Id", "dashboard_id")

	proxy.tracer.Inject(ctx, proxy.ctx.Req.Header, span)

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req)
}

func (proxy *DataSourceProxy) addTraceFromHeaderValue(span trace.Span, headerName string, tagName string) {
	panelId := proxy.ctx.Req.Header.Get(headerName)
	dashId, err := strconv.Atoi(panelId)
	if err == nil {
		span.SetAttributes(attribute.Int(tagName, dashId))
	}
}

func (proxy *DataSourceProxy) director(req *http.Request) {
	req.URL.Scheme = proxy.targetUrl.Scheme
	req.URL.Host = proxy.targetUrl.Host
	req.Host = proxy.targetUrl.Host

	reqQueryVals := req.URL.Query()

	ctxLogger := logger.FromContext(req.Context())
	ds := proxy.ds

	switch proxy.dataSource.PluginType() {
	case datasources.DS_INFLUXDB_08:
		password, err := proxy.dataSource.DecryptedPassword(req.Context())
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}

		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, "db/"+ds.Spec.Database()+"/"+proxy.proxyPath)
		reqQueryVals.Add("u", ds.Spec.User())
		reqQueryVals.Add("p", password)
		req.URL.RawQuery = reqQueryVals.Encode()
	case datasources.DS_INFLUXDB:
		password, err := proxy.dataSource.DecryptedPassword(req.Context())
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}
		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, proxy.proxyPath)
		req.URL.RawQuery = reqQueryVals.Encode()
		if !ds.Spec.BasicAuth() {
			req.Header.Set(
				"Authorization",
				util.GetBasicAuthHeader(ds.Spec.User(), password),
			)
		}
	default:
		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, proxy.proxyPath)
	}

	unescapedPath, err := url.PathUnescape(req.URL.RawPath)
	if err != nil {
		ctxLogger.Error("Failed to unescape raw path", "rawPath", req.URL.RawPath, "error", err)
		return
	}

	req.URL.Path = unescapedPath

	if ds.Spec.BasicAuth() {
		password, err := proxy.dataSource.DecryptedBasicAuthPassword(req.Context())
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}
		req.Header.Set("Authorization", util.GetBasicAuthHeader(ds.Spec.BasicAuthUser(),
			password))
	}

	dsAuth := req.Header.Get("X-DS-Authorization")
	if len(dsAuth) > 0 {
		req.Header.Del("X-DS-Authorization")
		req.Header.Set("Authorization", dsAuth)
	}

	proxyutil.ApplyUserHeader(proxy.settings.SendUserHeader, req, proxy.requester)

	proxyutil.ClearCookieHeader(req, ds.Spec.KeepCookies(), []string{proxy.settings.LoginCookieName})
	ua := proxy.settings.DataProxyUserAgent
	if proxy.settings.DataProxyForwardUserAgent {
		if originalUA := req.Header.Get("User-Agent"); originalUA != "" {
			if len(originalUA) > maxForwardedUserAgentLen {
				originalUA = originalUA[:maxForwardedUserAgentLen]
			}
			if ua != "" {
				ua = ua + " " + originalUA
			} else {
				ua = originalUA
			}
		}
	}
	req.Header.Set("User-Agent", ua)

	if proxy.matchedRoute != nil {
		decryptedValues, err := proxy.dataSource.DecryptedValues(req.Context())
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}

		ApplyRoute(req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo(ds, decryptedValues), proxy.settings)
	}

	if ds.Spec.IsOAuthPassThruEnabled() {
		if token := proxy.oAuthTokenService.GetCurrentOAuthToken(req.Context(), proxy.requester, proxy.ctx.UserToken); token != nil {
			req.Header.Set("Authorization", fmt.Sprintf("%s %s", token.Type(), token.AccessToken))

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				req.Header.Set("X-ID-Token", idToken)
			}
		}
	}

	proxyutil.ApplyForwardIDHeader(req, proxy.requester)
}

// dsInfo builds the DSInfo that ApplyRoute needs from a v0 datasource.
func dsInfo(ds *datasourcesV0.DataSource, decryptedValues map[string]string) DSInfo {
	// JSONData may be absent or stored as a non-map value; ApplyRoute requires a non-nil map, so fall back to empty.
	jsonData, ok := ds.Spec.JSONData().(map[string]any)
	if !ok {
		jsonData = make(map[string]any)
	}

	meta, _ := utils.MetaAccessor(ds)
	updated := ds.CreationTimestamp.Time
	if ts, _ := meta.GetUpdatedTimestamp(); ts != nil {
		updated = *ts
	}

	return DSInfo{
		ID: meta.GetDeprecatedInternalID(), // nolint:staticcheck

		URL:                     ds.Spec.URL(),
		Updated:                 updated,
		JSONData:                jsonData,
		DecryptedSecureJSONData: decryptedValues,
	}
}

func (proxy *DataSourceProxy) validateRequest() error {
	if !proxy.checkWhiteList() {
		return errors.New("target URL is not a valid target")
	}

	if proxy.dataSource.PluginType() == datasources.DS_ES {
		if proxy.ctx.Req.Method == "DELETE" {
			return errors.New("deletes not allowed on proxied Elasticsearch datasource")
		}
		if proxy.ctx.Req.Method == "PUT" {
			return errors.New("puts not allowed on proxied Elasticsearch datasource")
		}
		if proxy.ctx.Req.Method == "POST" && proxy.proxyPath != "_msearch" {
			return errors.New("posts not allowed on proxied Elasticsearch datasource except on /_msearch")
		}
	}

	// found route if there are any
	for _, route := range proxy.pluginRoutes {
		// method match
		if route.Method != "" && route.Method != "*" && route.Method != proxy.ctx.Req.Method {
			continue
		}

		// route match
		r1, err := plugins.CleanRelativePath(proxy.proxyPath)
		if err != nil {
			return err
		}
		r2, err := plugins.CleanRelativePath(route.Path)
		if err != nil {
			return err
		}
		// issues/116273: When we have an empty input route (or input that becomes relative to "."), we do not want it
		//   to be ".". This is because the `CleanRelativePath` function will never return "./" prefixes, and as such,
		//   the common prefix we need is an empty string.
		if r1 == "." && proxy.proxyPath != "." {
			r1 = ""
		}
		if r2 == "." && route.Path != "." {
			r2 = ""
		}
		if !strings.HasPrefix(r1, r2) {
			continue
		}

		if !proxy.hasAccessToRoute(route) {
			return errPluginProxyRouteAccessDenied
		}

		proxy.matchedRoute = route
		return nil
	}

	// Trailing validation below this point for routes that were not matched
	switch proxy.dataSource.PluginType() {
	case datasources.DS_PROMETHEUS,
		datasources.DS_AMAZON_PROMETHEUS,
		datasources.DS_AZURE_PROMETHEUS,
		datasources.DS_LOKI:
		switch proxy.ctx.Req.Method {
		case "DELETE", "PUT", "POST":
			return fmt.Errorf("non allow-listed %ss not allowed on proxied %s datasource", proxy.ctx.Req.Method, proxy.dataSource.PluginType())
		}
	}

	return nil
}

func (proxy *DataSourceProxy) hasAccessToRoute(route *plugins.Route) bool {
	ctxLogger := logger.FromContext(proxy.ctx.Req.Context())
	if route.ReqAction != "" {
		routeEval := pluginac.GetDataSourceRouteEvaluator(proxy.ds.Name, route.ReqAction)
		hasAccess := routeEval.Evaluate(proxy.requester.GetPermissions())
		if !hasAccess {
			ctxLogger.Debug("plugin route is covered by RBAC, user doesn't have access", "route", proxy.ctx.Req.URL.Path, "action", route.ReqAction, "path", route.Path, "method", route.Method)
		}
		return hasAccess
	}
	if route.ReqRole.IsValid() {
		if hasUserRole := proxy.requester.GetOrgRole().Includes(route.ReqRole); !hasUserRole {
			ctxLogger.Debug("plugin route is covered by org role, user doesn't have access", "route", proxy.ctx.Req.URL.Path, "role", route.ReqRole, "path", route.Path, "method", route.Method)
			return false
		}
	}
	return true
}

func (proxy *DataSourceProxy) logRequest() {
	if !proxy.settings.DataProxyLogging {
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
	panelPluginId := proxy.ctx.Req.Header.Get("X-Panel-Plugin-Id")

	uri, err := util.SanitizeURI(proxy.ctx.Req.RequestURI)
	if err != nil {
		ctxLogger.Error("Could not sanitize RequestURI", "error", err)
	}

	userid, _ := proxy.requester.GetInternalID()

	ctxLogger.Info("Proxying incoming request",
		"userid", userid,
		"orgid", proxy.requester.GetOrgID(),
		"username", proxy.requester.GetLogin(),
		"datasource", proxy.dataSource.PluginType(),
		"uri", uri,
		"method", proxy.ctx.Req.Method,
		"panelPluginId", panelPluginId,
		"body", body)
}

func (proxy *DataSourceProxy) checkWhiteList() bool {
	if proxy.targetUrl.Host != "" && len(proxy.settings.DataProxyWhiteList) > 0 {
		if _, exists := proxy.settings.DataProxyWhiteList[proxy.targetUrl.Host]; !exists {
			writeJSONErr(proxy.ctx.Resp, proxy.ctx.Req, 403, "Data proxy hostname and ip are not included in whitelist", nil)
			return false
		}
	}

	return true
}
