package api

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

var k8sProxyTransport *http.Transport

func ReverseProxyK8sReq(logger log.Logger, proxyPath string) *httputil.ReverseProxy {
	url, _ := url.Parse("https://127.0.0.1:6443")

	director := func(req *http.Request) {
		req.URL.Scheme = url.Scheme
		req.URL.Host = url.Host
		req.Host = url.Host

		ctx := req.Context()
		signedInUser := appcontext.MustUser(ctx)

		req.Header.Set("X-Remote-User", strconv.FormatInt(signedInUser.UserID, 10))
		req.Header.Set("X-Remote-Group", "grafana")
		req.Header.Set("X-Remote-Extra-token-name", signedInUser.Name)
		req.Header.Set("X-Remote-Extra-org-role", string(signedInUser.OrgRole))
		req.Header.Set("X-Remote-Extra-org-id", strconv.FormatInt(signedInUser.OrgID, 10))
		req.Header.Set("X-Remote-Extra-user-id", strconv.FormatInt(signedInUser.UserID, 10))

		req.URL.Path = util.JoinURLFragments(url.Path, proxyPath)
	}

	return proxyutil.NewReverseProxy(logger, director)
}

func getK8sHTTPTransport(datapath string) *http.Transport {
	if k8sProxyTransport == nil {
		certs := certgenerator.CertUtil{
			K8sDataPath: path.Join(datapath, "k8s"),
		}

		certPath := certs.K8sAuthnClientCertFile()
		keyPath := certs.K8sAuthnClientKeyFile()

		rootCerts := x509.NewCertPool()
		rootCert, err := certs.GetK8sCACert()
		if err != nil {
			panic(err)
		}
		rootCerts.AddCert(rootCert)

		cert, err := tls.LoadX509KeyPair(certPath, keyPath)
		if err != nil {
			panic(err)
		}

		k8sProxyTransport = &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout: 10 * time.Second,
			TLSClientConfig: &tls.Config{
				RootCAs:      rootCerts,
				ClientCAs:    rootCerts,
				Certificates: []tls.Certificate{cert},
				ClientAuth:   tls.RequireAndVerifyClientCert,
			},
		}
	}
	return k8sProxyTransport
}

func (hs *HTTPServer) ProxyK8sRequest(c *contextmodel.ReqContext) {
	proxyPath := web.Params(c.Req)["*"]
	proxy := ReverseProxyK8sReq(c.Logger, proxyPath)
	proxy.Transport = getK8sHTTPTransport(hs.Cfg.DataPath)
	proxy.ServeHTTP(c.Resp, c.Req)
}
