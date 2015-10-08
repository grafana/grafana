package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

<<<<<<< 2f1438800f66d353ba27af074d29b3439f6ba16a
<<<<<<< a84f1f0a3df6380f5a6561dd65aca819f7df5e8a
	// "github.com/Cepave/grafana/pkg/api/cloudwatch"
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/setting"
=======
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
>>>>>>> Replace the import path with github.com/Cepave/grafana.
	"github.com/Cepave/grafana/pkg/util"
=======
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
>>>>>>> feat(dataproxy): added whitelist setting and feature for data proxies, closes #2626
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

<<<<<<< 2f1438800f66d353ba27af074d29b3439f6ba16a
<<<<<<< 47688153d3c00e97d373e75e35c8747dadfffc2c
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
/**
 * @function:		func NewReverseProxy(ds *m.DataSource, proxyPath string, targetUrl *url.URL) *httputil.ReverseProxy
 * @description:	This function initializes a reverse proxy.
 * @related issues:	OWL-168, OWL-123, OWL-028, OWL-017, OWL-002
 * @param:			ds *m.DataSource
 * @param:			proxyPath string
 * @param:			targetUrl *url.URL
 * @return:			*httputil.ReverseProxy
 * @author:			Don Hsieh
 * @since:			07/17/2015
 * @last modified: 	11/09/2015
 * @called by:		func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
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
=======
func NewReverseProxy(ds *m.DataSource, proxyPath string, targetUrl *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

>>>>>>> feat(dataproxy): added whitelist setting and feature for data proxies, closes #2626
		reqQueryVals := req.URL.Query()

		if ds.Type == m.DS_INFLUXDB_08 {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, "db/"+ds.Database+"/"+proxyPath)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
			reqQueryVals.Add("db", ds.Database)
<<<<<<< d16bd3c036f843857e879a92c5adddaf23d0791e
			req.URL.RawQuery = reqQueryVals.Encode()
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
			if !ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
		} else if ds.Type == "openfalcon" {
			urlDashboard := configOpenFalcon.Datasource.UrlDashboard
			urlQuery := configOpenFalcon.Datasource.UrlQuery
			reqQueryVals.Add("target", ds.Url)
			reqQueryVals.Add("urlDashboard", urlDashboard)
			reqQueryVals.Add("urlQuery", urlQuery)
=======
		} else if ds.Type == "openfalcon" {
			urlDashboard := configOpenFalcon.Datasource.UrlDashboard
			urlQuery := configOpenFalcon.Datasource.UrlQuery
			reqQueryVals.Add("target", ds.Url)
<<<<<<< 47688153d3c00e97d373e75e35c8747dadfffc2c
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
			reqQueryVals.Add("urlDashboard", urlDashboard)
			reqQueryVals.Add("urlQuery", urlQuery)
>>>>>>> [OWL-123] update Open-Falcon query and dashboard URL for Grafana
			req.URL.RawQuery = reqQueryVals.Encode()

			ds.Url = "http://localhost"
			var port = "4001"
			ds.Url += ":" + port
<<<<<<< 47688153d3c00e97d373e75e35c8747dadfffc2c
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
			proxyPath = "/"
			target, _ := url.Parse(ds.Url)
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
=======
			// fmt.Printf("NewReverseProxy ds.Url = %v\n", ds.Url)
=======
>>>>>>> [OWL-123] update Open-Falcon query and dashboard URL for Grafana
			proxyPath = "/"
			target, _ := url.Parse(ds.Url)
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
=======
			req.URL.RawQuery = reqQueryVals.Encode()
			if !ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
>>>>>>> influxdb(auth): fixed issue with using basic auth and influxdb, fixes #2455
		} else {
<<<<<<< 2f1438800f66d353ba27af074d29b3439f6ba16a
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
		} else {
=======
>>>>>>> feat(dataproxy): added whitelist setting and feature for data proxies, closes #2626
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

<<<<<<< 5aed00979aa8f2b04b309ef13d8eb287478cd207
<<<<<<< 2f1438800f66d353ba27af074d29b3439f6ba16a
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
=======
	ds := query.Result
>>>>>>> feat(dataproxy): added whitelist setting and feature for data proxies, closes #2626
=======
>>>>>>> fixed gofmt issue
	targetUrl, _ := url.Parse(ds.Url)
	if len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[targetUrl.Host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return
		}
	}

<<<<<<< 5aed00979aa8f2b04b309ef13d8eb287478cd207
<<<<<<< 2f1438800f66d353ba27af074d29b3439f6ba16a
	if ds.Type == m.DS_CLOUDWATCH {
		// cloudwatch.HandleRequest(c)
	} else {
		proxyPath := c.Params("*")
		proxy := NewReverseProxy(ds, proxyPath, targetUrl)
=======
	if query.Result.Type == m.DS_CLOUDWATCH {
		ProxyCloudWatchDataSourceRequest(c)
	} else {
		proxyPath := c.Params("*")
		proxy := NewReverseProxy(&ds, proxyPath, targetUrl)
>>>>>>> feat(dataproxy): added whitelist setting and feature for data proxies, closes #2626
=======
	if ds.Type == m.DS_CLOUDWATCH {
		cloudwatch.HandleRequest(c)
	} else {
		proxyPath := c.Params("*")
		proxy := NewReverseProxy(ds, proxyPath, targetUrl)
>>>>>>> fixed gofmt issue
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
