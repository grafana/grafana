package api

import (
  "github.com/grafana/grafana/pkg/middleware"
  "github.com/grafana/grafana/pkg/netcrunch"
)

func GetNetCrunchServerSettings(c *middleware.Context) {
  c.JSON(200, &netcrunch.NetCrunchServerSettings)
}
