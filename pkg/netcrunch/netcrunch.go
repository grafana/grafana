package netcrunch

import (
  "github.com/grafana/grafana/pkg/setting"
)

var (
  NetCrunchServerSettings setting.NetCrunchSettings
)

func Init() {
  NetCrunchServerSettings = setting.NetCrunch
}
