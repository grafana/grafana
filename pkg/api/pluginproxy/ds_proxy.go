package pluginproxy

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/opentracing/opentracing-go"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger     = log.New("data-proxy-log")
	tokenCache = map[string]*jwtToken{}
	client     = newHTTPClient()
)

type jwtToken struct {
	ExpiresOn       time.Time `json:"-"`
	ExpiresOnString string    `json:"expires_on"`
	AccessToken     string    `json:"access_token"`
}

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
			proxy.applyRoute(req)
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

func (proxy *DataSourceProxy) applyRoute(req *http.Request) {
	proxy.proxyPath = strings.TrimPrefix(proxy.proxyPath, proxy.route.Path)

	data := templateData{
		JsonData:       proxy.ds.JsonData.Interface().(map[string]interface{}),
		SecureJsonData: proxy.ds.SecureJsonData.Decrypt(),
	}

	routeURL, err := url.Parse(proxy.route.Url)
	if err != nil {
		logger.Error("Error parsing plugin route url")
		return
	}

	req.URL.Scheme = routeURL.Scheme
	req.URL.Host = routeURL.Host
	req.Host = routeURL.Host
	req.URL.Path = util.JoinUrlFragments(routeURL.Path, proxy.proxyPath)

	if err := addHeaders(&req.Header, proxy.route, data); err != nil {
		logger.Error("Failed to render plugin headers", "error", err)
	}

	if proxy.route.TokenAuth != nil {
		if token, err := proxy.getAccessToken(data); err != nil {
			logger.Error("Failed to get access token", "error", err)
		} else {
			req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", token))
		}
	}

	logger.Info("Requesting", "url", req.URL.String())
}

func (proxy *DataSourceProxy) getAccessToken(data templateData) (string, error) {
	if cachedToken, found := tokenCache[proxy.getAccessTokenCacheKey()]; found {
		if cachedToken.ExpiresOn.After(time.Now().Add(time.Second * 10)) {
			logger.Info("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	urlInterpolated, err := interpolateString(proxy.route.TokenAuth.Url, data)
	if err != nil {
		return "", err
	}

	params := make(url.Values)
	for key, value := range proxy.route.TokenAuth.Params {
		interpolatedParam, err := interpolateString(value, data)
		if err != nil {
			return "", err
		}
		params.Add(key, interpolatedParam)
	}

	getTokenReq, _ := http.NewRequest("POST", urlInterpolated, bytes.NewBufferString(params.Encode()))
	getTokenReq.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	getTokenReq.Header.Add("Content-Length", strconv.Itoa(len(params.Encode())))

	resp, err := client.Do(getTokenReq)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	var token jwtToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return "", err
	}

	expiresOnEpoch, _ := strconv.ParseInt(token.ExpiresOnString, 10, 64)
	token.ExpiresOn = time.Unix(expiresOnEpoch, 0)
	tokenCache[proxy.getAccessTokenCacheKey()] = &token

	logger.Info("Got new access token", "ExpiresOn", token.ExpiresOn)
	return token.AccessToken, nil
}

func (proxy *DataSourceProxy) getAccessTokenCacheKey() string {
	return fmt.Sprintf("%v_%v_%v", proxy.ds.Id, proxy.route.Path, proxy.route.Method)
}

func interpolateString(text string, data templateData) (string, error) {
	t, err := template.New("content").Parse(text)
	if err != nil {
		return "", fmt.Errorf("could not parse template %s", text)
	}

	var contentBuf bytes.Buffer
	err = t.Execute(&contentBuf, data)
	if err != nil {
		return "", fmt.Errorf("failed to execute template %s", text)
	}

	return contentBuf.String(), nil
}

func addHeaders(reqHeaders *http.Header, route *plugins.AppPluginRoute, data templateData) error {
	for _, header := range route.Headers {
		interpolated, err := interpolateString(header.Content, data)
		if err != nil {
			return err
		}
		reqHeaders.Add(header.Name, interpolated)
	}

	return nil
}
