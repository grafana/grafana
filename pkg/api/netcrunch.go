package api

import (
  "net/url"
  "github.com/grafana/grafana/pkg/middleware"
  "github.com/grafana/grafana/pkg/netcrunch"
  "github.com/grafana/grafana/pkg/setting"
)

func GetNetCrunchServerSettings(c *middleware.Context) {
  c.JSON(200, &netcrunch.NetCrunchServerSettings)
}

func GetNetCrunchDatasource(c *middleware.Context) {
  c.JSON(200, netcrunch.GetNetCrunchDataSource())
}

func ProxyNetCrunchServerRequest(c *middleware.Context) {

  datasource := netcrunch.GetNetCrunchDataSource()
  NetCrunchServerSettings := setting.NetCrunch
  datasource.Url = datasource.Url + "/" + NetCrunchServerSettings.Api + "/"
  url, _ := url.Parse(datasource.Url)

  proxyPath := c.Params("*")
  proxy := NewReverseProxy(&datasource, proxyPath, url)
  proxy.Transport = dataProxyTransport
  proxy.ServeHTTP(c.RW(), c.Req.Request)
}
