package api

import (
  "github.com/grafana/grafana/pkg/middleware"
  "github.com/grafana/grafana/pkg/netcrunch"
)

func GetNetCrunchServerSettings(c *middleware.Context) {
  c.JSON(200, &netcrunch.NetCrunchServerSettings)
}

func GetNetCrunchDatasource(c *middleware.Context) {
  c.JSON(200, netcrunch.GetNetCrunchDataSource())
}

func ProxyNetCrunchServerRequest(c *middleware.Context) {

  datasource := netcrunch.GetNetCrunchDataSource()

  proxyPath := c.Params("*")
  proxy := NewReverseProxy(&datasource, proxyPath)
  proxy.Transport = dataProxyTransport
  proxy.ServeHTTP(c.RW(), c.Req.Request)
}
