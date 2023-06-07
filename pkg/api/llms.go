package api

import (
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var LLMProxyTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSHandshakeTimeout: 10 * time.Second,
}

func reverseProxyLLMReq(logger log.Logger, proxyPath string, settings setting.LLMSettings, body io.ReadCloser) *httputil.ReverseProxy {
	url, _ := url.Parse("https://api.openai.com")
	return &httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			r.SetURL(url)
			r.Out.Header.Set("Authorization", "Bearer "+settings.OpenAIAPIKey)
			r.Out.URL.Path = strings.TrimPrefix(proxyPath, "openai")
			logger.Debug("proxying request", "url", r.Out.URL.String())
		},
	}
}

func (hs *HTTPServer) ProxyLLMRequest(c *contextmodel.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := reverseProxyLLMReq(c.Logger, proxyPath, hs.Cfg.LLM, c.Req.Body)
	proxy.Transport = LLMProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req)
}
