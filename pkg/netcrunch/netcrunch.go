package netcrunch

import (
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/models"
)

var (
  NetCrunchServerSettings setting.NetCrunchSettings
)

func Init() {
  NetCrunchServerSettings = setting.NetCrunch
}

func GetNetCrunchServerUrl() string {
  return NetCrunchServerSettings.Protocol + "://" + NetCrunchServerSettings.Host + ":" +
         NetCrunchServerSettings.Port + "/" + NetCrunchServerSettings.Api + "/"
}

func GetNetCrunchDataSource() models.DataSource {
  return models.DataSource {
    Id:                 -1,
    OrgId:              -1,
    Version:            0,
    Name:               "NetCrunch",
    Type:               models.DS_NETCRUNCH,
    Access:             models.DS_ACCESS_PROXY,
    Url:                GetNetCrunchServerUrl(),
    User:               NetCrunchServerSettings.User,
    Password:           NetCrunchServerSettings.Password,
    Database:           "",
    BasicAuth:          false,
    BasicAuthUser:      "",
    BasicAuthPassword:  "",
    IsDefault:          true,
  }
}
