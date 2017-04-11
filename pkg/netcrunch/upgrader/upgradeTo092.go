package upgrader

import (
  "errors"
  "strings"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
  "github.com/grafana/grafana/pkg/components/simplejson"
)

const DS_NETCRUNCH_90 = "netcrunch"

func upgradeTo092() (bool, error) {
  uLog := log.New("GrafCrunch upgrader")
  UPGRADE_ERROR_MSG := "Upgrade to 9.2 error"

  if (config.ServerSettingsFileExist()) {
    if (!config.VersionFileExist() && updateNetCrunchDatasource() && config.RemoveServerSettingsFile()) {
      uLog.Info("Upgrade successful to 9.2")

      if (config.UpgradeMarkerFileExist()) {
	config.SetInitializationSuccess()
	config.RemoveUpgradeMarkerFile()
      }

      config.WriteVersionFile()
      return true, nil
    }
    uLog.Info(UPGRADE_ERROR_MSG)
    return false, errors.New(UPGRADE_ERROR_MSG)
  }

  return false, nil
}

func updateNetCrunchDatasource() bool {
  netCrunchServerSettings, err := config.ReadNetCrunchServerSettingsFile()

  if (err == nil) {
    result := true
    orgs, found := model.GetOrgs()
    if found {
      for index := range orgs {
        if (updateNetCrunchDefaultDatasource(netCrunchServerSettings, orgs[index].Id) == false) {
          result = false;
        }
      }
    }
    return result
  }

  return false
}

func updateNetCrunchDefaultDatasource(netCrunchSettings config.NetCrunchServerSettings, orgId int64) bool {
  datasource, found := model.GetDataSourceByName("NetCrunch", orgId)

  if found {
    datasource.Url = getNetCrunchServerUrl(netCrunchSettings)
    datasource.Type = DS_NETCRUNCH_90
    datasource.JsonData = createDatasourceJsonData(netCrunchSettings)
    return model.UpdateDataSource(datasource, orgId)
  } else {
    datasource := getDefaultNetCrunchDataSource(netCrunchSettings)
    return model.AddDataSource(datasource, orgId)
  }
}

func getNetCrunchServerUrl(netCrunchServerSettings config.NetCrunchServerSettings) string {
  return netCrunchServerSettings.Protocol + "://" + getNetCrunchServerSimpleUrl(netCrunchServerSettings)
}

func getNetCrunchServerSimpleUrl(netCrunchServerSettings config.NetCrunchServerSettings) string {
  return netCrunchServerSettings.Host + ":" + netCrunchServerSettings.Port
}

func createDatasourceJsonData(netCrunchServerSettings config.NetCrunchServerSettings) *simplejson.Json {
  jsonDataBuffer := simplejson.New()

  jsonDataBuffer.Set("simpleUrl", getNetCrunchServerSimpleUrl(netCrunchServerSettings))
  jsonDataBuffer.Set("isSSL", (strings.Compare(strings.ToUpper(netCrunchServerSettings.Protocol), "HTTPS") == 0))
  jsonDataBuffer.Set("user", netCrunchServerSettings.User)
  jsonDataBuffer.Set("password", netCrunchServerSettings.Password)

  return jsonDataBuffer
}

func getDefaultNetCrunchDataSource(netCrunchServerSettings config.NetCrunchServerSettings) models.DataSource {
  jsonDataBuffer := createDatasourceJsonData(netCrunchServerSettings)

  return models.DataSource {
    Name:               "NetCrunch",
    Type:               DS_NETCRUNCH_90,
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
