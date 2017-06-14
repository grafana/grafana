package api

import (
	"bytes"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/cloudwatch"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	dataproxyLogger log.Logger = log.New("data-proxy-log")
)

func NewReverseProxy(ds *m.DataSource, proxyPath string, targetUrl *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

		reqQueryVals := req.URL.Query()

		if ds.Type == m.DS_INFLUXDB_08 {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, "db/"+ds.Database+"/"+proxyPath)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
			req.URL.RawQuery = reqQueryVals.Encode()
			if !ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
		} else {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
		}

		if ds.BasicAuth {
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.BasicAuthUser, ds.BasicAuthPassword))
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

		// reqBytes, _ := httputil.DumpRequestOut(req, true);
		// log.Trace("Proxying datasource request: %s", string(reqBytes))
	}

	return &httputil.ReverseProxy{Director: director, FlushInterval: time.Millisecond * 200}
}

func getDatasource(id int64, orgId int64) (*m.DataSource, error) {
	query := m.GetDataSourceByIdQuery{Id: id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

func ProxyDataSourceRequest(c *middleware.Context) {
	c.TimeRequest(metrics.M_DataSource_ProxyReq_Timer)

	ds, err := getDatasource(c.ParamsInt64(":id"), c.OrgId)

	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	if ds.Type == m.DS_INFLUXDB {
		if c.Query("db") != ds.Database {
			c.JsonApiErr(403, "Datasource is not configured to allow this database", nil)
			return
		}
	}

	if ds.Type == m.DS_CLOUDWATCH {
		cloudwatch.HandleRequest(c, ds)
		return
	}

	targetUrl, _ := url.Parse(ds.Url)
	if !checkWhiteList(c, targetUrl.Host) {
		return
	}

	proxyPath := c.Params("*")

	if ds.Type == m.DS_PROMETHEUS {
		if c.Req.Request.Method != http.MethodGet || !strings.HasPrefix(proxyPath, "api/") {
			c.JsonApiErr(403, "GET is only allowed on proxied Prometheus datasource", nil)
			return
		}
	}

	if ds.Type == m.DS_ES {
		if c.Req.Request.Method == "DELETE" {
			c.JsonApiErr(403, "Deletes not allowed on proxied Elasticsearch datasource", nil)
			return
		}
		if c.Req.Request.Method == "PUT" {
			c.JsonApiErr(403, "Puts not allowed on proxied Elasticsearch datasource", nil)
			return
		}
		if c.Req.Request.Method == "POST" && proxyPath != "_msearch" {
			c.JsonApiErr(403, "Posts not allowed on proxied Elasticsearch datasource except on /_msearch", nil)
			return
		}
	}

	proxy := NewReverseProxy(ds, proxyPath, targetUrl)
	proxy.Transport, err = ds.GetHttpTransport()
	if err != nil {
		c.JsonApiErr(400, "Unable to load TLS certificate", err)
		return
	}

	logProxyRequest(ds.Type, c)
	proxy.ServeHTTP(c.Resp, c.Req.Request)
	c.Resp.Header().Del("Set-Cookie")
}

func logProxyRequest(dataSourceType string, c *middleware.Context) {
	if !setting.DataProxyLogging {
		return
	}

	var body string
	if c.Req.Request.Body != nil {
		buffer, err := ioutil.ReadAll(c.Req.Request.Body)
		if err == nil {
			c.Req.Request.Body = ioutil.NopCloser(bytes.NewBuffer(buffer))
			body = string(buffer)
		}
	}

	dataproxyLogger.Info("Proxying incoming request",
		"userid", c.UserId,
		"orgid", c.OrgId,
		"username", c.Login,
		"datasource", dataSourceType,
		"uri", c.Req.RequestURI,
		"method", c.Req.Request.Method,
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
