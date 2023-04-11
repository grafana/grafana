package api

import (
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

var k8sProxyTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSHandshakeTimeout: 10 * time.Second,
	TLSClientConfig: &tls.Config{
		InsecureSkipVerify: true,
	},
}

func ReverseProxyK8sReq(logger log.Logger, proxyPath string) *httputil.ReverseProxy {
	url, _ := url.Parse("https://127.0.0.1:6443")

	director := func(req *http.Request) {
		req.URL.Scheme = url.Scheme
		req.URL.Host = url.Host
		req.Host = url.Host

		ctx := req.Context()
		signedInUser := appcontext.MustUser(ctx)

		req.Header.Set("X-Remote-User", strconv.FormatInt(signedInUser.UserID, 10))
		req.Header.Set("X-Remote-Extra-token-name", signedInUser.Name)
		req.Header.Set("X-Remote-Extra-org-role", string(signedInUser.OrgRole))
		req.Header.Set("X-Remote-Extra-org-id", strconv.FormatInt(signedInUser.OrgID, 10))
		req.Header.Set("X-Remote-Extra-user-id", strconv.FormatInt(signedInUser.UserID, 10))

		req.URL.Path = util.JoinURLFragments(url.Path, proxyPath)
	}

	return proxyutil.NewReverseProxy(logger, director)
}

func (hs *HTTPServer) ProxyK8sRequest(c *contextmodel.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := ReverseProxyK8sReq(c.Logger, proxyPath)
	proxy.Transport = k8sProxyTransport
	proxy.ServeHTTP(c.Resp, c.Req)
}
