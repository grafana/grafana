package api

import (
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var grafanaComProxyTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 10 * time.Second,
}

func ReverseProxyGnetReq(proxyPath string, version string) *httputil.ReverseProxy {
	url, _ := url.Parse(setting.GrafanaComUrl)

	director := func(req *http.Request) {
		req.URL.Scheme = url.Scheme
		req.URL.Host = url.Host
		req.Host = url.Host

		req.URL.Path = util.JoinURLFragments(url.Path+"/api", proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
		req.Header.Del("Authorization")

		// send the current Grafana version for each request proxied to GCOM
		req.Header.Add("grafana-version", version)
	}

	return &httputil.ReverseProxy{Director: director}
}

func (hs *HTTPServer) ProxyGnetRequest(c *models.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := ReverseProxyGnetReq(proxyPath, hs.Cfg.BuildVersion)
	proxy.Transport = grafanaComProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req)
	c.Resp.Header().Del("Set-Cookie")
}
