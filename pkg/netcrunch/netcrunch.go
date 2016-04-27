package netcrunch

import (
  "errors"
  "path/filepath"
  "gopkg.in/ini.v1"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
)

type NetCrunchServerSettings struct {
  Host        string  `json:"host"`
  Port        string  `json:"port"`
  Protocol    string  `json:"protocol"`

  User        string  `json:"user"`
  Password    string  `json:"password"`
}

var (
  UpgradeFile *ini.File
)

func getUpgradeFilesBasePath() string {
  UpgradeFilesBasePath := setting.Cfg.Section("paths").Key("data").String()

  if (!filepath.IsAbs(UpgradeFilesBasePath)) {
    UpgradeFilesBasePath = filepath.Join(setting.HomePath, UpgradeFilesBasePath)
  }
  return UpgradeFilesBasePath
}

func getUpgradeFileName() string {
  return filepath.Join(getUpgradeFilesBasePath(), "setup.ini")
}

func getVersionFileName() string {
  return filepath.Join(getUpgradeFilesBasePath(), "version")
}

func loadUpgradeFile(filePath string) bool {
  var err error

  UpgradeFile, err = ini.Load(filePath)
  UpgradeFile.BlockMode = false

  return (err == nil)
}

func readNetCrunchServerSettings() (NetCrunchServerSettings, error) {
  var
    NCServerSettings NetCrunchServerSettings

  section, err := UpgradeFile.GetSection("netcrunch-server")
  if (err == nil) {
    NCServerSettings.Host = section.Key("host").MustString("127.0.0.1")
    NCServerSettings.Port = section.Key("port").MustString("80")
    NCServerSettings.Protocol = section.Key("protocol").MustString("http")
    NCServerSettings.User = section.Key("user").MustString("")
    NCServerSettings.Password = section.Key("password").MustString("")
    return NCServerSettings, nil
  } else {
    return NCServerSettings, errors.New("[netcrunch-server] section doesn't exist")
  }
}

func getNetCrunchServerUrl(netCrunchSettings NetCrunchServerSettings) string {
  return netCrunchSettings.Protocol + "://" + netCrunchSettings.Host + ":" + netCrunchSettings.Port
}

func getDefaultNetCrunchDataSource(netCrunchSettings NetCrunchServerSettings) models.DataSource {
  return models.DataSource {
    Name:               "NetCrunch",
    Type:               models.DS_NETCRUNCH,
    Access:             models.DS_ACCESS_PROXY,
    Url:                getNetCrunchServerUrl(netCrunchSettings),
    User:               netCrunchSettings.User,
    Password:           netCrunchSettings.Password,
    Database:           "",
    BasicAuth:          false,
    BasicAuthUser:      "",
    BasicAuthPassword:  "",
    IsDefault:          true,
  }
}

func getDataSourceByName(datasourceName string, orgID int64) (models.DataSource, bool) {
  query := models.GetDataSourceByNameQuery {
    Name: datasourceName,
    OrgId: orgID,
  }

  err := bus.Dispatch(&query)
  return query.Result, (err == nil)
}

func addDataSource(datasource models.DataSource, orgId int64) bool {
  command := models.AddDataSourceCommand {
    OrgId:             orgId,
    Name:              datasource.Name,
    Type:              datasource.Type,
    Access:            datasource.Access,
    Url:               datasource.Url,
    User:              datasource.User,
    Password:          datasource.Password,
    Database:          datasource.Database,
    BasicAuth:         datasource.BasicAuth,
    BasicAuthUser:     datasource.BasicAuthUser,
    BasicAuthPassword: datasource.BasicAuthPassword,
    WithCredentials:   datasource.WithCredentials,
    IsDefault:         datasource.IsDefault,
  }
  return (bus.Dispatch(&command) == nil)
}

func updateDataSource(datasource models.DataSource, orgId int64) bool {
  command := models.UpdateDataSourceCommand {
    Id:                datasource.Id,
    OrgId:             orgId,
    Name:              datasource.Name,
    Type:              datasource.Type,
    Access:            datasource.Access,
    Url:               datasource.Url,
    User:              datasource.User,
    Password:          datasource.Password,
    Database:          datasource.Database,
    BasicAuth:         datasource.BasicAuth,
    BasicAuthUser:     datasource.BasicAuthUser,
    BasicAuthPassword: datasource.BasicAuthPassword,
    WithCredentials:   datasource.WithCredentials,
    IsDefault:         datasource.IsDefault,
  }
  return (bus.Dispatch(&command) == nil)
}

func updateNetCrunchDatasource(netCrunchSettings NetCrunchServerSettings, orgId int64) bool {
  datasource, found := getDataSourceByName("NetCrunch", orgId)

  if found {
    datasource.Url = getNetCrunchServerUrl(netCrunchSettings)
    datasource.User = netCrunchSettings.User
    datasource.Password = netCrunchSettings.Password
    return updateDataSource(datasource, orgId)
  } else {
    datasource := getDefaultNetCrunchDataSource(netCrunchSettings)
    return addDataSource(datasource, orgId)
  }
}

//***

func updateNetCrunchDatasources(netCrunchSettings NetCrunchServerSettings) bool {
  updateNetCrunchDatasource(netCrunchSettings, 1)
  return true
}

//***

func Upgrade() {

  UpgradeFileName := getUpgradeFileName()
  if (setting.PathExists(UpgradeFileName) && loadUpgradeFile(UpgradeFileName)) {
    netCrunchSettings, err := readNetCrunchServerSettings()
    if (err == nil) {
      if updateNetCrunchDatasources(netCrunchSettings) {
        log.Info("NetCrunch: Upgrade")
      } else {
        log.Info("NetCrunch: Upgrade error")
      }
    } else {
      log.Info("NetCrunch: Upgrade error")
    }
  }
}
