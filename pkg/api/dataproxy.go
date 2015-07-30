package api

import (
	// "fmt"
	// "strings"
	// "bytes"
	// "reflect"
	
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
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


/**
 * @function:		func NewReverseProxy(ds *m.DataSource, proxyPath string) *httputil.ReverseProxy
 * @description:	This function initializes a reverse proxy.
 * @related issues:	OWL-017, OWL-002
 * @param:			*m.DataSource ds
 * @param:			string proxyPath
 * @return:			*httputil.ReverseProxy
 * @author:			Don Hsieh
 * @since:			07/17/2015
 * @last modified: 	07/30/2015
 * @called by:		func ProxyDataSourceRequest(c *middleware.Context)
 *					 in pkg/api/dataproxy.go
 */
func NewReverseProxy(ds *m.DataSource, proxyPath string) *httputil.ReverseProxy {
	target, _ := url.Parse(ds.Url)
	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Host = target.Host		
		reqQueryVals := req.URL.Query()

		if ds.Type == m.DS_INFLUXDB_08 {
			req.URL.Path = util.JoinUrlFragments(target.Path, "db/"+ds.Database+"/"+proxyPath)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
			reqQueryVals.Add("db", ds.Database)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if ds.Type == "openfalcon" {
			// fmt.Printf("Welcome to %v!\n", ds.Type)
			// fmt.Printf("NewReverseProxy req = %v\n", req)
			// fmt.Printf("NewReverseProxy req.Method = %v\n", req.Method)
			// fmt.Printf("NewReverseProxy req.URL = %v\n", req.URL)
			// fmt.Printf("NewReverseProxy req.RequestURI = %v\n", req.RequestURI)
			reqQueryVals.Add("target", ds.Url)
			req.URL.RawQuery = reqQueryVals.Encode()

			ds.Url = "http://localhost"
			var port = "4001"
			ds.Url += ":" + port
			// fmt.Printf("NewReverseProxy ds.Url = %v\n", ds.Url)
			proxyPath = "/"
			target, _ := url.Parse(ds.Url)
			// fmt.Printf("NewReverseProxy target = %v\n", target)
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
			// fmt.Printf("NewReverseProxy req.URL.Path = %v\n", req.URL.Path)
			// fmt.Printf("NewReverseProxy Now = %v\n", int32(time.Now().Unix()))
			// fmt.Printf("NewReverseProxy req.URL = %v\n", req.URL)
			// fmt.Printf("NewReverseProxy req.URL.RawQuery = %v\n", req.URL.RawQuery)
		} else {
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
		}
		if ds.BasicAuth {
			req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.BasicAuthUser, ds.BasicAuthPassword))
		}
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

	proxyPath := c.Params("*")
	// fmt.Printf("proxyPath = %v\n", proxyPath)
	proxy := NewReverseProxy(&query.Result, proxyPath)
	// fmt.Printf("proxy = %v\n", proxy)
	proxy.Transport = dataProxyTransport
	proxy.ServeHTTP(c.RW(), c.Req.Request)
}
