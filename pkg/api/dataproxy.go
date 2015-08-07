package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

<<<<<<< 2a5dc9d78a8348937a25624bf121704836c7f07c
	"github.com/grafana/grafana/pkg/api/cloudwatch"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
=======
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/util"
>>>>>>> Replace the import path with github.com/Cepave/grafana.
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

<<<<<<< 98cbab4ab5c4a3e9cb0b7f87b2ebe2e76d292acb
<<<<<<< 6397b8c1ef60e96800e3e9c76ccabae4410bc088
func NewReverseProxy(ds *m.DataSource, proxyPath string, targetUrl *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

=======

=======
>>>>>>> [OWL-123] update Open-Falcon query and dashboard URL for Grafana
/**
 * @function:		func NewReverseProxy(ds *m.DataSource, proxyPath string) *httputil.ReverseProxy
 * @description:	This function initializes a reverse proxy.
 * @related issues:	OWL-123, OWL-028, OWL-017, OWL-002
 * @param:			*m.DataSource ds
 * @param:			string proxyPath
 * @return:			*httputil.ReverseProxy
 * @author:			Don Hsieh
 * @since:			07/17/2015
 * @last modified: 	10/19/2015
 * @called by:		func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
func NewReverseProxy(ds *m.DataSource, proxyPath string) *httputil.ReverseProxy {
	target, _ := url.Parse(ds.Url)
	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Host = target.Host		
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
		reqQueryVals := req.URL.Query()

		if ds.Type == m.DS_INFLUXDB_08 {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, "db/"+ds.Database+"/"+proxyPath)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
			reqQueryVals.Add("db", ds.Database)
<<<<<<< b321d4d39f52afce6f32ef2b78f9cd42747dd840
			req.URL.RawQuery = reqQueryVals.Encode()
<<<<<<< 6397b8c1ef60e96800e3e9c76ccabae4410bc088
			if !ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
=======
		} else if ds.Type == "openfalcon" {
			urlDashboard := configOpenFalcon.Datasource.UrlDashboard
			urlQuery := configOpenFalcon.Datasource.UrlQuery
			reqQueryVals.Add("target", ds.Url)
			reqQueryVals.Add("urlDashboard", urlDashboard)
			reqQueryVals.Add("urlQuery", urlQuery)
			req.URL.RawQuery = reqQueryVals.Encode()

			ds.Url = "http://localhost"
			var port = "4001"
			ds.Url += ":" + port
			proxyPath = "/"
			target, _ := url.Parse(ds.Url)
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
<<<<<<< aedb273f3baeaf58ed16d85efb16b4645680f121
			// fmt.Printf("NewReverseProxy req.URL.Path = %v\n", req.URL.Path)
			// fmt.Printf("NewReverseProxy Now = %v\n", int32(time.Now().Unix()))
			// fmt.Printf("NewReverseProxy req.URL = %v\n", req.URL)
			// fmt.Printf("NewReverseProxy req.URL.RawQuery = %v\n", req.URL.RawQuery)
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
=======
			req.URL.RawQuery = reqQueryVals.Encode()
			if !ds.BasicAuth {
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
>>>>>>> influxdb(auth): fixed issue with using basic auth and influxdb, fixes #2455
		} else {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
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

var dsMap map[int64]*m.DataSource = make(map[int64]*m.DataSource)

func getDatasource(id int64, orgId int64) (*m.DataSource, error) {
	// ds, exists := dsMap[id]
	// if exists && ds.OrgId == orgId {
	// 	return ds, nil
	// }

	query := m.GetDataSourceByIdQuery{Id: id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	dsMap[id] = &query.Result
	return &query.Result, nil
}

func ProxyDataSourceRequest(c *middleware.Context) {
	ds, err := getDatasource(c.ParamsInt64(":id"), c.OrgId)
	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

<<<<<<< 6397b8c1ef60e96800e3e9c76ccabae4410bc088
	targetUrl, _ := url.Parse(ds.Url)
	if len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[targetUrl.Host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return
		}
	}

	if ds.Type == m.DS_CLOUDWATCH {
		cloudwatch.HandleRequest(c)
	} else {
		proxyPath := c.Params("*")
		proxy := NewReverseProxy(ds, proxyPath, targetUrl)
		proxy.Transport = dataProxyTransport
		proxy.ServeHTTP(c.RW(), c.Req.Request)
	}
=======
	proxyPath := c.Params("*")
	proxy := NewReverseProxy(&query.Result, proxyPath)
	proxy.Transport = dataProxyTransport
	proxy.ServeHTTP(c.RW(), c.Req.Request)
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
}
