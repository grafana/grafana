package api

import (
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
)

func GraphiteProxy(c *middleware.Context) {
	proxyPath := c.Params("*")
	target, _ := url.Parse(setting.GraphiteUrl)

	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Header.Add("X-Org-Id", strconv.FormatInt(c.OrgId, 10))
		req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)

	}

	proxy := &httputil.ReverseProxy{Director: director}

	proxy.ServeHTTP(c.RW(), c.Req.Request)
}
