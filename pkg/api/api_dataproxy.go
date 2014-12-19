package api

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}

func NewReverseProxy(target *url.URL, proxyPath string) *httputil.ReverseProxy {
	targetQuery := target.RawQuery

	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.URL.Path = singleJoiningSlash(target.Path, proxyPath)
		if targetQuery == "" || req.URL.RawQuery == "" {
			req.URL.RawQuery = targetQuery + req.URL.RawQuery
		} else {
			req.URL.RawQuery = targetQuery + "&" + req.URL.RawQuery
		}
	}

	return &httputil.ReverseProxy{Director: director}
}

// TODO: need to cache datasources
func ProxyDataSourceRequest(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetDataSourceByIdQuery{
		Id:        id,
		AccountId: c.GetAccountId(),
	}

	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
	}

	proxyPath := c.Params("*")
	url, _ := url.Parse(query.Result.Url)
	proxy := NewReverseProxy(url, proxyPath)
	proxy.ServeHTTP(c.RW(), c.Req.Request)
}
