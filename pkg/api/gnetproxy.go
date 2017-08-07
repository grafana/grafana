package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"time"

	"github.com/wangy1931/grafana/pkg/middleware"
	"github.com/wangy1931/grafana/pkg/util"
)

var gNetProxyTransport = &http.Transport{
	TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
	Proxy:           http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 10 * time.Second,
}

func ReverseProxyGnetReq(proxyPath string) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = "https"
		req.URL.Host = "grafana.net"
		req.Host = "grafana.net"

		req.URL.Path = util.JoinUrlFragments("https://grafana.net/api", proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
	}

	return &httputil.ReverseProxy{Director: director}
}

func ProxyGnetRequest(c *middleware.Context) {
	proxyPath := c.Params("*")
	proxy := ReverseProxyGnetReq(proxyPath)
	proxy.Transport = gNetProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req.Request)
	c.Resp.Header().Del("Set-Cookie")
}
