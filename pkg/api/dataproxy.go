package api

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/util"
)

func NewReverseProxy(ds *m.DataSource, proxyPath string) *httputil.ReverseProxy {
	target, _ := url.Parse(ds.Url)

	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host

		reqQueryVals := req.URL.Query()

		if ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(target.Path, "db/"+ds.Database+"/"+proxyPath)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else {
			req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)
		}
	}

	return &httputil.ReverseProxy{Director: director}
}

// TODO: need to cache datasources
func ProxyDataSourceRequest(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetDataSourceByIdQuery{
		Id:        id,
		AccountId: c.AccountId,
	}

	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
	}

	proxyPath := c.Params("*")
	proxy := NewReverseProxy(&query.Result, proxyPath)
	proxy.ServeHTTP(c.RW(), c.Req.Request)
}
