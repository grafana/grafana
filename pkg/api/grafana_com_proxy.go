package api

import (
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

var grafanaComProxyTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSHandshakeTimeout: 10 * time.Second,
}

func (hs *HTTPServer) reverseProxyGnetReq(logger log.Logger, proxyPath string) *httputil.ReverseProxy {
	url, _ := url.Parse(hs.Cfg.GrafanaComAPIURL)

	director := func(req *http.Request) {
		req.URL.Scheme = url.Scheme
		req.URL.Host = url.Host
		req.Host = url.Host

		req.URL.Path = util.JoinURLFragments(url.Path, proxyPath)

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
		req.Header.Del("Authorization")

		// send the current Grafana version for each request proxied to GCOM
		req.Header.Add("grafana-version", hs.Cfg.BuildVersion)

		// add plugin instalation token if set
		if hs.Cfg.PluginsInstallToken != "" {
			req.Header.Add("Authorization", "Bearer "+hs.Cfg.PluginsInstallToken)
		}
	}

	return proxyutil.NewReverseProxy(logger, director)
}

func (hs *HTTPServer) ProxyGnetRequest(c *contextmodel.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := hs.reverseProxyGnetReq(c.Logger, proxyPath)
	proxy.Transport = grafanaComProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req)
}
