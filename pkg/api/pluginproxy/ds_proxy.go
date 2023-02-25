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

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
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
}

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// NewDataSourceProxy creates a new Datasource proxy
func NewDataSourceProxy(ds *datasources.DataSource, pluginRoutes []*plugins.Route, ctx *contextmodel.ReqContext,
	proxyPath string, cfg *setting.Cfg, clientProvider httpclient.Provider,
	oAuthTokenService oauthtoken.OAuthTokenService, dsService datasources.DataSourceService,
	tracer tracing.Tracer) (*DataSourceProxy, error) {
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

	span.SetAttributes("datasource_name", proxy.ds.Name, attribute.Key("datasource_name").String(proxy.ds.Name))
	span.SetAttributes("datasource_type", proxy.ds.Type, attribute.Key("datasource_type").String(proxy.ds.Type))
	span.SetAttributes("user", proxy.ctx.SignedInUser.Login, attribute.Key("user").String(proxy.ctx.SignedInUser.Login))
	span.SetAttributes("org_id", proxy.ctx.SignedInUser.OrgID, attribute.Key("org_id").Int64(proxy.ctx.SignedInUser.OrgID))

	proxy.addTraceFromHeaderValue(span, "X-Panel-Id", "panel_id")
	proxy.addTraceFromHeaderValue(span, "X-Dashboard-Id", "dashboard_id")

	proxy.tracer.Inject(ctx, proxy.ctx.Req.Header, span)

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req)
}

func (proxy *DataSourceProxy) addTraceFromHeaderValue(span tracing.Span, headerName string, tagName string) {
	panelId := proxy.ctx.Req.Header.Get(headerName)
	dashId, err := strconv.Atoi(panelId)
	if err == nil {
		span.SetAttributes(tagName, dashId, attribute.Key(tagName).Int(dashId))
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

	jsonData := make(map[string]interface{})
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
}

func (proxy *DataSourceProxy) validateRequest() error {
	if !checkWhiteList(proxy.ctx, proxy.targetUrl.Host) {
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
		if !strings.HasPrefix(proxy.proxyPath, route.Path) {
			continue
		}

		if route.ReqRole.IsValid() {
			if !proxy.ctx.HasUserRole(route.ReqRole) {
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

	ctxLogger := logger.FromContext(proxy.ctx.Req.Context())
	ctxLogger.Info("Proxying incoming request",
		"userid", proxy.ctx.UserID,
		"orgid", proxy.ctx.OrgID,
		"username", proxy.ctx.Login,
		"datasource", proxy.ds.Type,
		"uri", proxy.ctx.Req.RequestURI,
		"method", proxy.ctx.Req.Method,
		"body", body)
}

func checkWhiteList(c *contextmodel.ReqContext, host string) bool {
	if host != "" && len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return false
		}
	}

	return true
}
