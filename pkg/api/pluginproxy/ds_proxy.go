package pluginproxy

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/opentracing/opentracing-go"
)

var (
	logger = glog.New("data-proxy-log")
	client = newHTTPClient()
)

type DataSourceProxy struct {
	ds                *models.DataSource
	ctx               *models.ReqContext
	targetUrl         *url.URL
	proxyPath         string
	route             *plugins.AppPluginRoute
	plugin            *plugins.DataSourcePlugin
	cfg               *setting.Cfg
	clientProvider    httpclient.Provider
	oAuthTokenService oauthtoken.OAuthTokenService
}

type handleResponseTransport struct {
	transport http.RoundTripper
}

func (t *handleResponseTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	res, err := t.transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	res.Header.Del("Set-Cookie")
	return res, nil
}

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type logWrapper struct {
	logger glog.Logger
}

// Write writes log messages as bytes from proxy
func (lw *logWrapper) Write(p []byte) (n int, err error) {
	withoutNewline := strings.TrimSuffix(string(p), "\n")
	lw.logger.Error("Data proxy error", "error", withoutNewline)
	return len(p), nil
}

// NewDataSourceProxy creates a new Datasource proxy
func NewDataSourceProxy(ds *models.DataSource, plugin *plugins.DataSourcePlugin, ctx *models.ReqContext,
	proxyPath string, cfg *setting.Cfg, clientProvider httpclient.Provider, oAuthTokenService oauthtoken.OAuthTokenService) (*DataSourceProxy, error) {
	targetURL, err := datasource.ValidateURL(ds.Type, ds.Url)
	if err != nil {
		return nil, err
	}

	return &DataSourceProxy{
		ds:                ds,
		plugin:            plugin,
		ctx:               ctx,
		proxyPath:         proxyPath,
		targetUrl:         targetURL,
		cfg:               cfg,
		clientProvider:    clientProvider,
		oAuthTokenService: oAuthTokenService,
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

	proxyErrorLogger := logger.New("userId", proxy.ctx.UserId, "orgId", proxy.ctx.OrgId, "uname", proxy.ctx.Login,
		"path", proxy.ctx.Req.URL.Path, "remote_addr", proxy.ctx.RemoteAddr(), "referer", proxy.ctx.Req.Referer())

	transport, err := proxy.ds.GetHTTPTransport(proxy.clientProvider)
	if err != nil {
		proxy.ctx.JsonApiErr(400, "Unable to load TLS certificate", err)
		return
	}

	reverseProxy := &httputil.ReverseProxy{
		Director:      proxy.director,
		FlushInterval: time.Millisecond * 200,
		ErrorLog:      log.New(&logWrapper{logger: proxyErrorLogger}, "", 0),
		Transport: &handleResponseTransport{
			transport: transport,
		},
		ModifyResponse: func(resp *http.Response) error {
			if resp.StatusCode == 401 {
				// The data source rejected the request as unauthorized, convert to 400 (bad request)
				body, err := ioutil.ReadAll(resp.Body)
				if err != nil {
					return fmt.Errorf("failed to read data source response body: %w", err)
				}
				_ = resp.Body.Close()

				proxyErrorLogger.Info("Authentication to data source failed", "body", string(body), "statusCode",
					resp.StatusCode)
				msg := "Authentication to data source failed"
				*resp = http.Response{
					StatusCode:    400,
					Status:        "Bad Request",
					Body:          ioutil.NopCloser(strings.NewReader(msg)),
					ContentLength: int64(len(msg)),
				}
			}
			return nil
		},
	}

	proxy.logRequest()

	span, ctx := opentracing.StartSpanFromContext(proxy.ctx.Req.Context(), "datasource reverse proxy")
	defer span.Finish()

	proxy.ctx.Req.Request = proxy.ctx.Req.WithContext(ctx)

	span.SetTag("datasource_name", proxy.ds.Name)
	span.SetTag("datasource_type", proxy.ds.Type)
	span.SetTag("user", proxy.ctx.SignedInUser.Login)
	span.SetTag("org_id", proxy.ctx.SignedInUser.OrgId)

	proxy.addTraceFromHeaderValue(span, "X-Panel-Id", "panel_id")
	proxy.addTraceFromHeaderValue(span, "X-Dashboard-Id", "dashboard_id")

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(proxy.ctx.Req.Request.Header)); err != nil {
		logger.Error("Failed to inject span context instance", "err", err)
	}

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req.Request)
}

func (proxy *DataSourceProxy) addTraceFromHeaderValue(span opentracing.Span, headerName string, tagName string) {
	panelId := proxy.ctx.Req.Header.Get(headerName)
	dashId, err := strconv.Atoi(panelId)
	if err == nil {
		span.SetTag(tagName, dashId)
	}
}

func (proxy *DataSourceProxy) director(req *http.Request) {
	req.URL.Scheme = proxy.targetUrl.Scheme
	req.URL.Host = proxy.targetUrl.Host
	req.Host = proxy.targetUrl.Host

	reqQueryVals := req.URL.Query()

	switch proxy.ds.Type {
	case models.DS_INFLUXDB_08:
		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, "db/"+proxy.ds.Database+"/"+proxy.proxyPath)
		reqQueryVals.Add("u", proxy.ds.User)
		reqQueryVals.Add("p", proxy.ds.DecryptedPassword())
		req.URL.RawQuery = reqQueryVals.Encode()
	case models.DS_INFLUXDB:
		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, proxy.proxyPath)
		req.URL.RawQuery = reqQueryVals.Encode()
		if !proxy.ds.BasicAuth {
			req.Header.Set("Authorization", util.GetBasicAuthHeader(proxy.ds.User, proxy.ds.DecryptedPassword()))
		}
	default:
		req.URL.RawPath = util.JoinURLFragments(proxy.targetUrl.Path, proxy.proxyPath)
	}

	unescapedPath, err := url.PathUnescape(req.URL.RawPath)
	if err != nil {
		logger.Error("Failed to unescape raw path", "rawPath", req.URL.RawPath, "error", err)
		return
	}

	req.URL.Path = unescapedPath

	if proxy.ds.BasicAuth {
		req.Header.Set("Authorization", util.GetBasicAuthHeader(proxy.ds.BasicAuthUser,
			proxy.ds.DecryptedBasicAuthPassword()))
	}

	dsAuth := req.Header.Get("X-DS-Authorization")
	if len(dsAuth) > 0 {
		req.Header.Del("X-DS-Authorization")
		req.Header.Set("Authorization", dsAuth)
	}

	applyUserHeader(proxy.cfg.SendUserHeader, req, proxy.ctx.SignedInUser)

	keepCookieNames := []string{}
	if proxy.ds.JsonData != nil {
		if keepCookies := proxy.ds.JsonData.Get("keepCookies"); keepCookies != nil {
			keepCookieNames = keepCookies.MustStringArray()
		}
	}

	proxyutil.ClearCookieHeader(req, keepCookieNames)
	proxyutil.PrepareProxyRequest(req)

	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	// Clear Origin and Referer to avoir CORS issues
	req.Header.Del("Origin")
	req.Header.Del("Referer")

	if proxy.route != nil {
		ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds, proxy.cfg)
	}

	if proxy.oAuthTokenService.IsOAuthPassThruEnabled(proxy.ds) {
		if token := proxy.oAuthTokenService.GetCurrentOAuthToken(proxy.ctx.Req.Context(), proxy.ctx.SignedInUser); token != nil {
			req.Header.Set("Authorization", fmt.Sprintf("%s %s", token.Type(), token.AccessToken))
		}
	}
}

func (proxy *DataSourceProxy) validateRequest() error {
	if !checkWhiteList(proxy.ctx, proxy.targetUrl.Host) {
		return errors.New("target URL is not a valid target")
	}

	if proxy.ds.Type == models.DS_ES {
		if proxy.ctx.Req.Request.Method == "DELETE" {
			return errors.New("deletes not allowed on proxied Elasticsearch datasource")
		}
		if proxy.ctx.Req.Request.Method == "PUT" {
			return errors.New("puts not allowed on proxied Elasticsearch datasource")
		}
		if proxy.ctx.Req.Request.Method == "POST" && proxy.proxyPath != "_msearch" {
			return errors.New("posts not allowed on proxied Elasticsearch datasource except on /_msearch")
		}
	}

	// found route if there are any
	if len(proxy.plugin.Routes) > 0 {
		for _, route := range proxy.plugin.Routes {
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

			proxy.route = route
			return nil
		}
	}

	// Trailing validation below this point for routes that were not matched
	if proxy.ds.Type == models.DS_PROMETHEUS {
		if proxy.ctx.Req.Request.Method == "DELETE" {
			return errors.New("non allow-listed DELETEs not allowed on proxied Prometheus datasource")
		}
		if proxy.ctx.Req.Request.Method == "PUT" {
			return errors.New("non allow-listed PUTs not allowed on proxied Prometheus datasource")
		}
		if proxy.ctx.Req.Request.Method == "POST" {
			return errors.New("non allow-listed POSTs not allowed on proxied Prometheus datasource")
		}
	}

	return nil
}

func (proxy *DataSourceProxy) logRequest() {
	if !setting.DataProxyLogging {
		return
	}

	var body string
	if proxy.ctx.Req.Request.Body != nil {
		buffer, err := ioutil.ReadAll(proxy.ctx.Req.Request.Body)
		if err == nil {
			proxy.ctx.Req.Request.Body = ioutil.NopCloser(bytes.NewBuffer(buffer))
			body = string(buffer)
		}
	}

	logger.Info("Proxying incoming request",
		"userid", proxy.ctx.UserId,
		"orgid", proxy.ctx.OrgId,
		"username", proxy.ctx.Login,
		"datasource", proxy.ds.Type,
		"uri", proxy.ctx.Req.RequestURI,
		"method", proxy.ctx.Req.Request.Method,
		"body", body)
}

func checkWhiteList(c *models.ReqContext, host string) bool {
	if host != "" && len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return false
		}
	}

	return true
}
