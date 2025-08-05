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

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	pluginac "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

var (
	logger = glog.New("data-proxy-log")
	client = newHTTPClient()
)

type DataSourceProxy struct {
	ds                 *datasources.DataSource
	ctx                *contextmodel.ReqContext
	targetUrl          *url.URL
	proxyPath          string
	matchedRoute       *plugins.Route
	pluginRoutes       []*plugins.Route
	cfg                *setting.Cfg
	clientProvider     httpclient.Provider
	oAuthTokenService  oauthtoken.OAuthTokenService
	dataSourcesService datasources.DataSourceService
	tracer             tracing.Tracer
	features           featuremgmt.FeatureToggles
}

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// NewDataSourceProxy creates a new Datasource proxy
func NewDataSourceProxy(ds *datasources.DataSource, pluginRoutes []*plugins.Route, ctx *contextmodel.ReqContext,
	proxyPath string, cfg *setting.Cfg, clientProvider httpclient.Provider,
	oAuthTokenService oauthtoken.OAuthTokenService, dsService datasources.DataSourceService,
	tracer tracing.Tracer, features featuremgmt.FeatureToggles) (*DataSourceProxy, error) {
	targetURL, err := datasource.ValidateURL(ds.Type, ds.URL)
	if err != nil {
		return nil, err
	}

	return &DataSourceProxy{
		ds:                 ds,
		pluginRoutes:       pluginRoutes,
		ctx:                ctx,
		proxyPath:          proxyPath,
		targetUrl:          targetURL,
		cfg:                cfg,
		clientProvider:     clientProvider,
		oAuthTokenService:  oAuthTokenService,
		dataSourcesService: dsService,
		tracer:             tracer,
		features:           features,
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
		proxy.ctx.JsonApiErr(403, err.Error(), nil)
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

	transport, err := proxy.dataSourcesService.GetHTTPTransport(proxy.ctx.Req.Context(), proxy.ds, proxy.clientProvider)
	if err != nil {
		proxy.ctx.JsonApiErr(400, "Unable to load TLS certificate", err)
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
		attribute.String("datasource_name", proxy.ds.Name),
		attribute.String("datasource_type", proxy.ds.Type),
		attribute.String("user", proxy.ctx.SignedInUser.Login),
		attribute.Int64("org_id", proxy.ctx.SignedInUser.OrgID),
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

	switch proxy.ds.Type {
	case datasources.DS_INFLUXDB_08:
		password, err := proxy.dataSourcesService.DecryptedPassword(req.Context(), proxy.ds)
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}

		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, "db/"+proxy.ds.Database+"/"+proxy.proxyPath)
		reqQueryVals.Add("u", proxy.ds.User)
		reqQueryVals.Add("p", password)
		req.URL.RawQuery = reqQueryVals.Encode()
	case datasources.DS_INFLUXDB:
		password, err := proxy.dataSourcesService.DecryptedPassword(req.Context(), proxy.ds)
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}
		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, proxy.proxyPath)
		req.URL.RawQuery = reqQueryVals.Encode()
		if !proxy.ds.BasicAuth {
			req.Header.Set(
				"Authorization",
				util.GetBasicAuthHeader(proxy.ds.User, password),
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

	if proxy.ds.BasicAuth {
		password, err := proxy.dataSourcesService.DecryptedBasicAuthPassword(req.Context(), proxy.ds)
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}
		req.Header.Set("Authorization", util.GetBasicAuthHeader(proxy.ds.BasicAuthUser,
			password))
	}

	dsAuth := req.Header.Get("X-DS-Authorization")
	if len(dsAuth) > 0 {
		req.Header.Del("X-DS-Authorization")
		req.Header.Set("Authorization", dsAuth)
	}

	proxyutil.ApplyUserHeader(proxy.cfg.SendUserHeader, req, proxy.ctx.SignedInUser)

	proxyutil.ClearCookieHeader(req, proxy.ds.AllowedCookies(), []string{proxy.cfg.LoginCookieName})
	req.Header.Set("User-Agent", proxy.cfg.DataProxyUserAgent)

	jsonData := make(map[string]any)
	if proxy.ds.JsonData != nil {
		jsonData, err = proxy.ds.JsonData.Map()
		if err != nil {
			ctxLogger.Error("Failed to get json data as map", "jsonData", proxy.ds.JsonData, "error", err)
			return
		}
	}

	if proxy.matchedRoute != nil {
		decryptedValues, err := proxy.dataSourcesService.DecryptedValues(req.Context(), proxy.ds)
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}

		ApplyRoute(req.Context(), req, proxy.proxyPath, proxy.matchedRoute, DSInfo{
			ID:                      proxy.ds.ID,
			URL:                     proxy.ds.URL,
			Updated:                 proxy.ds.Updated,
			JSONData:                jsonData,
			DecryptedSecureJSONData: decryptedValues,
		}, proxy.cfg)
	}

	if proxy.oAuthTokenService.IsOAuthPassThruEnabled(proxy.ds) {
		if token := proxy.oAuthTokenService.GetCurrentOAuthToken(req.Context(), proxy.ctx.SignedInUser); token != nil {
			req.Header.Set("Authorization", fmt.Sprintf("%s %s", token.Type(), token.AccessToken))

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				req.Header.Set("X-ID-Token", idToken)
			}
		}
	}

	proxyutil.ApplyForwardIDHeader(req, proxy.ctx.SignedInUser)
}

func (proxy *DataSourceProxy) validateRequest() error {
	if !proxy.checkWhiteList() {
		return errors.New("target URL is not a valid target")
	}

	if proxy.ds.Type == datasources.DS_ES {
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
		r1, err := util.CleanRelativePath(proxy.proxyPath)
		if err != nil {
			return err
		}
		r2, err := util.CleanRelativePath(route.Path)
		if err != nil {
			return err
		}
		if !strings.HasPrefix(r1, r2) {
			continue
		}

		if proxy.features.IsEnabled(proxy.ctx.Req.Context(), featuremgmt.FlagDatasourceProxyDisableRBAC) {
			// TODO(aarongodin): following logic can be removed with FlagDatasourceProxyDisableRBAC as it is covered by
			// proxy.hasAccessToRoute(..)
			if route.ReqRole.IsValid() && !proxy.ctx.HasUserRole(route.ReqRole) {
				return errors.New("plugin proxy route access denied")
			}
		} else {
			if !proxy.hasAccessToRoute(route) {
				return errors.New("plugin proxy route access denied")
			}
		}

		proxy.matchedRoute = route
		return nil
	}

	// Trailing validation below this point for routes that were not matched
	if proxy.ds.Type == datasources.DS_PROMETHEUS {
		if proxy.ctx.Req.Method == "DELETE" {
			return errors.New("non allow-listed DELETEs not allowed on proxied Prometheus datasource")
		}
		if proxy.ctx.Req.Method == "PUT" {
			return errors.New("non allow-listed PUTs not allowed on proxied Prometheus datasource")
		}
		if proxy.ctx.Req.Method == "POST" {
			return errors.New("non allow-listed POSTs not allowed on proxied Prometheus datasource")
		}
	}

	return nil
}

func (proxy *DataSourceProxy) hasAccessToRoute(route *plugins.Route) bool {
	ctxLogger := logger.FromContext(proxy.ctx.Req.Context())
	useRBAC := proxy.features.IsEnabled(proxy.ctx.Req.Context(), featuremgmt.FlagAccessControlOnCall) && route.ReqAction != ""
	if useRBAC {
		routeEval := pluginac.GetDataSourceRouteEvaluator(proxy.ds.UID, route.ReqAction)
		hasAccess := routeEval.Evaluate(proxy.ctx.GetPermissions())
		if !hasAccess {
			ctxLogger.Debug("plugin route is covered by RBAC, user doesn't have access", "route", proxy.ctx.Req.URL.Path, "action", route.ReqAction, "path", route.Path, "method", route.Method)
		}
		return hasAccess
	}
	if route.ReqRole.IsValid() {
		if hasUserRole := proxy.ctx.HasUserRole(route.ReqRole); !hasUserRole {
			ctxLogger.Debug("plugin route is covered by org role, user doesn't have access", "route", proxy.ctx.Req.URL.Path, "role", route.ReqRole, "path", route.Path, "method", route.Method)
			return false
		}
	}
	return true
}

func (proxy *DataSourceProxy) logRequest() {
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

	panelPluginId := proxy.ctx.Req.Header.Get("X-Panel-Plugin-Id")

	uri, err := util.SanitizeURI(proxy.ctx.Req.RequestURI)
	if err == nil {
		proxy.ctx.Logger.Error("Could not sanitize RequestURI", "error", err)
	}

	ctxLogger := logger.FromContext(proxy.ctx.Req.Context())
	ctxLogger.Info("Proxying incoming request",
		"userid", proxy.ctx.UserID,
		"orgid", proxy.ctx.OrgID,
		"username", proxy.ctx.Login,
		"datasource", proxy.ds.Type,
		"uri", uri,
		"method", proxy.ctx.Req.Method,
		"panelPluginId", panelPluginId,
		"body", body)
}

func (proxy *DataSourceProxy) checkWhiteList() bool {
	if proxy.targetUrl.Host != "" && len(proxy.cfg.DataProxyWhiteList) > 0 {
		if _, exists := proxy.cfg.DataProxyWhiteList[proxy.targetUrl.Host]; !exists {
			proxy.ctx.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return false
		}
	}

	return true
}
