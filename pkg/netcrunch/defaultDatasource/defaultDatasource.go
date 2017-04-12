package defaultDatasource

import (
  "strings"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/components/simplejson"
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
)

const DS_NETCRUNCH_DEFAULT_TYPE = "adremsoft-netcrunch-datasource"

func addDefaultNetCrunchDatasourceForOrg(netCrunchSettings config.NetCrunchServerSettings, orgId int64) bool {
  defaultDatasource := getDefaultNetCrunchDatasource(netCrunchSettings)
  return model.AddDataSource(defaultDatasource, orgId)
}

func getDefaultNetCrunchDatasource(netCrunchServerSettings config.NetCrunchServerSettings) models.DataSource {
  jsonDataBuffer := createDatasourceJsonData(netCrunchServerSettings)

  return models.DataSource{
    Name:               "NetCrunch",
    Type:               DS_NETCRUNCH_DEFAULT_TYPE,
    Access:             models.DS_ACCESS_PROXY,
    Url:                getNetCrunchServerUrl(netCrunchServerSettings),
    User:               "",
    Password:           "",
    Database:           "",
    BasicAuth:          false,
    BasicAuthUser:      "",
    BasicAuthPassword:  "",
    IsDefault:          true,
    JsonData:           jsonDataBuffer,
  }
}

func createDatasourceJsonData(netCrunchServerSettings config.NetCrunchServerSettings) *simplejson.Json {
  jsonDataBuffer := simplejson.New()

  jsonDataBuffer.Set("simpleUrl", getNetCrunchServerSimpleUrl(netCrunchServerSettings))
  jsonDataBuffer.Set("isSSL", (strings.Compare(strings.ToUpper(netCrunchServerSettings.Protocol), "HTTPS") == 0))
  jsonDataBuffer.Set("user", netCrunchServerSettings.User)
  jsonDataBuffer.Set("password", netCrunchServerSettings.Password)

  return jsonDataBuffer
}

func getNetCrunchServerUrl(netCrunchServerSettings config.NetCrunchServerSettings) string {
  return netCrunchServerSettings.Protocol + "://" + getNetCrunchServerSimpleUrl(netCrunchServerSettings)
}

func getNetCrunchServerSimpleUrl(netCrunchServerSettings config.NetCrunchServerSettings) string {
  return netCrunchServerSettings.Host + ":" + netCrunchServerSettings.Port
}
