package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var dataProxyTransport = &http.Transport{
	TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	Proxy:           http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 10 * time.Second,
}

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
			reqQueryVals.Add("db", ds.Database)
			req.URL.RawQuery = reqQueryVals.Encode()
			if !ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
		} else if ds.Type == m.DS_NETCRUNCH {
      req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
    } else {
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
		}

		if ds.BasicAuth {
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.BasicAuthUser, ds.BasicAuthPassword))
		}

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
	}

	return &httputil.ReverseProxy{Director: director}
}

//ProxyDataSourceRequest TODO need to cache datasources
func ProxyDataSourceRequest(c *middleware.Context) {
  id := c.ParamsInt64(":id")
  query := m.GetDataSourceByIdQuery{Id: id, OrgId: c.OrgId}

  if err := bus.Dispatch(&query); err != nil {
    c.JsonApiErr(500, "Unable to load datasource meta data", err)
    return
  }

  ds := query.Result
  targetUrl, _ := url.Parse(ds.Url)
  if len(setting.DataProxyWhiteList) > 0 {
    if _, exists := setting.DataProxyWhiteList[targetUrl.Host]; !exists {
      c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
      return
    }
  }

  if query.Result.Type == m.DS_CLOUDWATCH {
    ProxyCloudWatchDataSourceRequest(c)
  } else {
    proxyPath := c.Params("*")
    proxy := NewReverseProxy(&ds, proxyPath, targetUrl)
    proxy.Transport = dataProxyTransport
    proxy.ServeHTTP(c.RW(), c.Req.Request)
  }
}
