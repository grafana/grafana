package pluginproxy

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/opentracing/opentracing-go"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("data-proxy-log")
	client = newHTTPClient()
)

type DataSourceProxy struct {
	ds        *m.DataSource
	ctx       *m.ReqContext
	targetUrl *url.URL
	proxyPath string
	route     *plugins.AppPluginRoute
	plugin    *plugins.DataSourcePlugin
}

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

func NewDataSourceProxy(ds *m.DataSource, plugin *plugins.DataSourcePlugin, ctx *m.ReqContext, proxyPath string) *DataSourceProxy {
	targetURL, _ := url.Parse(ds.Url)

	return &DataSourceProxy{
		ds:        ds,
		plugin:    plugin,
		ctx:       ctx,
		proxyPath: proxyPath,
		targetUrl: targetURL,
	}
}

func newHTTPClient() httpClient {
	return &http.Client{
		Timeout:   time.Second * 30,
		Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
	}
}

func (proxy *DataSourceProxy) HandleRequest() {
	if err := proxy.validateRequest(); err != nil {
		proxy.ctx.JsonApiErr(403, err.Error(), nil)
		return
	}

	reverseProxy := &httputil.ReverseProxy{
		Director:      proxy.getDirector(),
		FlushInterval: time.Millisecond * 200,
	}

	var err error
	reverseProxy.Transport, err = proxy.ds.GetHttpTransport()
	if err != nil {
		proxy.ctx.JsonApiErr(400, "Unable to load TLS certificate", err)
		return
	}

	proxy.logRequest()

	span, ctx := opentracing.StartSpanFromContext(proxy.ctx.Req.Context(), "datasource reverse proxy")
	proxy.ctx.Req.Request = proxy.ctx.Req.WithContext(ctx)

	defer span.Finish()
	span.SetTag("datasource_id", proxy.ds.Id)
	span.SetTag("datasource_type", proxy.ds.Type)
	span.SetTag("user_id", proxy.ctx.SignedInUser.UserId)
	span.SetTag("org_id", proxy.ctx.SignedInUser.OrgId)

	proxy.addTraceFromHeaderValue(span, "X-Panel-Id", "panel_id")
	proxy.addTraceFromHeaderValue(span, "X-Dashboard-Id", "dashboard_id")

	opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(proxy.ctx.Req.Request.Header))

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req.Request)
	proxy.ctx.Resp.Header().Del("Set-Cookie")
}

func (proxy *DataSourceProxy) addTraceFromHeaderValue(span opentracing.Span, headerName string, tagName string) {
	panelId := proxy.ctx.Req.Header.Get(headerName)
	dashId, err := strconv.Atoi(panelId)
	if err == nil {
		span.SetTag(tagName, dashId)
	}
}

func (proxy *DataSourceProxy) useCustomHeaders(req *http.Request) {
	decryptSdj := proxy.ds.SecureJsonData.Decrypt()
	index := 1
	for {
		headerNameSuffix := fmt.Sprintf("httpHeaderName%d", index)
		headerValueSuffix := fmt.Sprintf("httpHeaderValue%d", index)
		if key := proxy.ds.JsonData.Get(headerNameSuffix).MustString(); key != "" {
			if val, ok := decryptSdj[headerValueSuffix]; ok {
				// remove if exists
				if req.Header.Get(key) != "" {
					req.Header.Del(key)
				}
				req.Header.Add(key, val)
				logger.Debug("Using custom header ", "CustomHeaders", key)
			}
		} else {
			break
		}
		index += 1
	}
}

func (proxy *DataSourceProxy) getDirector() func(req *http.Request) {
	return func(req *http.Request) {
		req.URL.Scheme = proxy.targetUrl.Scheme
		req.URL.Host = proxy.targetUrl.Host
		req.Host = proxy.targetUrl.Host

		reqQueryVals := req.URL.Query()

		if proxy.ds.Type == m.DS_INFLUXDB_08 {
			req.URL.Path = util.JoinUrlFragments(proxy.targetUrl.Path, "db/"+proxy.ds.Database+"/"+proxy.proxyPath)
			reqQueryVals.Add("u", proxy.ds.User)
			reqQueryVals.Add("p", proxy.ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if proxy.ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(proxy.targetUrl.Path, proxy.proxyPath)
			req.URL.RawQuery = reqQueryVals.Encode()
			if !proxy.ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(proxy.ds.User, proxy.ds.Password))
			}
		} else {
			req.URL.Path = util.JoinUrlFragments(proxy.targetUrl.Path, proxy.proxyPath)
		}
		if proxy.ds.BasicAuth {
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", util.GetBasicAuthHeader(proxy.ds.BasicAuthUser, proxy.ds.BasicAuthPassword))
		}

		// Lookup and use custom headers
		if proxy.ds.SecureJsonData != nil {
			proxy.useCustomHeaders(req)
		}

		dsAuth := req.Header.Get("X-DS-Authorization")
		if len(dsAuth) > 0 {
			req.Header.Del("X-DS-Authorization")
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", dsAuth)
		}

		// clear cookie header, except for whitelisted cookies
		var keptCookies []*http.Cookie
		if proxy.ds.JsonData != nil {
			if keepCookies := proxy.ds.JsonData.Get("keepCookies"); keepCookies != nil {
				keepCookieNames := keepCookies.MustStringArray()
				for _, c := range req.Cookies() {
					for _, v := range keepCookieNames {
						if c.Name == v {
							keptCookies = append(keptCookies, c)
						}
					}
				}
			}
		}
		req.Header.Del("Cookie")
		for _, c := range keptCookies {
			req.AddCookie(c)
		}

		// clear X-Forwarded Host/Port/Proto headers
		req.Header.Del("X-Forwarded-Host")
		req.Header.Del("X-Forwarded-Port")
		req.Header.Del("X-Forwarded-Proto")
		req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

		// Clear Origin and Referer to avoir CORS issues
		req.Header.Del("Origin")
		req.Header.Del("Referer")

		// set X-Forwarded-For header
		if req.RemoteAddr != "" {
			remoteAddr, _, err := net.SplitHostPort(req.RemoteAddr)
			if err != nil {
				remoteAddr = req.RemoteAddr
			}
			if req.Header.Get("X-Forwarded-For") != "" {
				req.Header.Set("X-Forwarded-For", req.Header.Get("X-Forwarded-For")+", "+remoteAddr)
			} else {
				req.Header.Set("X-Forwarded-For", remoteAddr)
			}
		}

		if proxy.route != nil {
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds)
		}
	}
}

func (proxy *DataSourceProxy) validateRequest() error {
	if !checkWhiteList(proxy.ctx, proxy.targetUrl.Host) {
		return errors.New("Target url is not a valid target")
	}

	if proxy.ds.Type == m.DS_PROMETHEUS {
		if proxy.ctx.Req.Request.Method == "DELETE" {
			return errors.New("Deletes not allowed on proxied Prometheus datasource")
		}
		if proxy.ctx.Req.Request.Method == "PUT" {
			return errors.New("Puts not allowed on proxied Prometheus datasource")
		}
		if proxy.ctx.Req.Request.Method == "POST" && !(proxy.proxyPath == "api/v1/query" || proxy.proxyPath == "api/v1/query_range") {
			return errors.New("Posts not allowed on proxied Prometheus datasource except on /query and /query_range")
		}
	}

	if proxy.ds.Type == m.DS_ES {
		if proxy.ctx.Req.Request.Method == "DELETE" {
			return errors.New("Deletes not allowed on proxied Elasticsearch datasource")
		}
		if proxy.ctx.Req.Request.Method == "PUT" {
			return errors.New("Puts not allowed on proxied Elasticsearch datasource")
		}
		if proxy.ctx.Req.Request.Method == "POST" && proxy.proxyPath != "_msearch" {
			return errors.New("Posts not allowed on proxied Elasticsearch datasource except on /_msearch")
		}
	}

	// found route if there are any
	if len(proxy.plugin.Routes) > 0 {
		for _, route := range proxy.plugin.Routes {
			// method match
			if route.Method != "" && route.Method != "*" && route.Method != proxy.ctx.Req.Method {
				continue
			}

			if route.ReqRole.IsValid() {
				if !proxy.ctx.HasUserRole(route.ReqRole) {
					return errors.New("Plugin proxy route access denied")
				}
			}

			if strings.HasPrefix(proxy.proxyPath, route.Path) {
				proxy.route = route
				break
			}
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

func checkWhiteList(c *m.ReqContext, host string) bool {
	if host != "" && len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return false
		}
	}

	return true
}
