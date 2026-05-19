package directclient

import (
	"crypto/tls"
	"net/http"
	"net/http/httputil"
	"net/url"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

var queryServiceURL = url.URL{
	Host:   "query-grafana-app-main.grafana-datasources:6443",
	Scheme: "https",
}
var queryServiceReverseProxy httputil.ReverseProxy = *httputil.NewSingleHostReverseProxy(&queryServiceURL)

// Provides a direct proxy client for the query service from ST Grafana.
func QueryEndpoint(c *contextmodel.ReqContext) {
	queryServiceReverseProxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	queryServiceReverseProxy.ServeHTTP(c.Resp, c.Req)
}
