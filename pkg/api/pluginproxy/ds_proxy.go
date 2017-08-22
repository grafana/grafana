package pluginproxy

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/cloudwatch"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger log.Logger = log.New("data-proxy-log")
)

type DataSourceProxy struct {
	ds        *m.DataSource
	ctx       *middleware.Context
	targetUrl *url.URL
	proxyPath string
	route     *plugins.AppPluginRoute
}

func NewDataSourceProxy(ds *m.DataSource, ctx *middleware.Context, proxyPath string) *DataSourceProxy {
	return &DataSourceProxy{
		ds:        ds,
		ctx:       ctx,
		proxyPath: proxyPath,
	}
}

func (proxy *DataSourceProxy) HandleRequest() {
	if proxy.ds.Type == m.DS_CLOUDWATCH {
		cloudwatch.HandleRequest(proxy.ctx, proxy.ds)
		return
	}

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

	reverseProxy.ServeHTTP(proxy.ctx.Resp, proxy.ctx.Req.Request)
	proxy.ctx.Resp.Header().Del("Set-Cookie")
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

		dsAuth := req.Header.Get("X-DS-Authorization")
		if len(dsAuth) > 0 {
			req.Header.Del("X-DS-Authorization")
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", dsAuth)
		}

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")

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
	if proxy.ds.Type == m.DS_INFLUXDB {
		if proxy.ctx.Query("db") != proxy.ds.Database {
			return errors.New("Datasource is not configured to allow this database")
		}
	}

	targetUrl, _ := url.Parse(proxy.ds.Url)
	if !checkWhiteList(proxy.ctx, targetUrl.Host) {
		return errors.New("Target url is not a valid target")
	}

	if proxy.ds.Type == m.DS_PROMETHEUS {
		if proxy.ctx.Req.Request.Method != http.MethodGet || !strings.HasPrefix(proxy.proxyPath, "api/") {
			return errors.New("GET is only allowed on proxied Prometheus datasource")
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
	if plugin, ok := plugins.DataSources[proxy.ds.Type]; ok {
		if len(plugin.Routes) > 0 {
			for _, route := range plugin.Routes {
				// method match
				if route.Method != "*" && route.Method != proxy.ctx.Req.Method {
					continue
				}

				if strings.HasPrefix(proxy.proxyPath, route.Path) {
					logger.Info("Apply Route Rule", "rule", route.Path)
					proxy.proxyPath = strings.TrimPrefix(proxy.proxyPath, route.Path)
					proxy.route = route
					break
				}
			}
		}
	}

	proxy.targetUrl = targetUrl
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

func checkWhiteList(c *middleware.Context, host string) bool {
	if host != "" && len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return false
		}
	}

	return true
}

func (proxy *DataSourceProxy) applyRoute(req *http.Request) {
	logger.Info("ApplyDataSourceRouteRules", "route", proxy.route.Path, "proxyPath", proxy.proxyPath)

	data := templateData{
		JsonData:       proxy.ds.JsonData.Interface().(map[string]interface{}),
		SecureJsonData: proxy.ds.SecureJsonData.Decrypt(),
	}

	logger.Info("Apply Route Rule", "rule", proxy.route.Path)

	routeUrl, err := url.Parse(proxy.route.Url)
	if err != nil {
		logger.Error("Error parsing plugin route url")
		return
	}

	req.URL.Scheme = routeUrl.Scheme
	req.URL.Host = routeUrl.Host
	req.Host = routeUrl.Host
	req.URL.Path = util.JoinUrlFragments(routeUrl.Path, proxy.proxyPath)

	if err := addHeaders(&req.Header, proxy.route, data); err != nil {
		logger.Error("Failed to render plugin headers", "error", err)
	}
}

func addHeaders(reqHeaders *http.Header, route *plugins.AppPluginRoute, data templateData) error {
	for _, header := range route.Headers {
		var contentBuf bytes.Buffer
		t, err := template.New("content").Parse(header.Content)
		if err != nil {
			return errors.New(fmt.Sprintf("could not parse header content template for header %s.", header.Name))
		}

		err = t.Execute(&contentBuf, data)
		if err != nil {
			return errors.New(fmt.Sprintf("failed to execute header content template for header %s.", header.Name))
		}

		value := contentBuf.String()

		logger.Info("Adding headers", "name", header.Name, "value", value)
		reqHeaders.Add(header.Name, value)
	}

	return nil
}
