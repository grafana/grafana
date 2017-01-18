package netcrunch

import (
  "os"
  "errors"
  "strings"
  "path/filepath"
  "io/ioutil"
  "gopkg.in/ini.v1"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/components/simplejson"
  "github.com/grafana/grafana/pkg/plugins"
)

type NetCrunchServerSettings struct {
  Host        string  `json:"host"`
  Port        string  `json:"port"`
  Protocol    string  `json:"protocol"`

  User        string  `json:"user"`
  Password    string  `json:"password"`
}

const (
  NETCRUNCH_APP_PLUGIN_ID string = "grafana-netcrunch"
)

var (
  UpgradeFile *ini.File
  StatusesFile *ini.File
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

func getUpgradeMarkerFileName() string {
  return filepath.Join(getUpgradeFilesBasePath(), "upgrade")
}

func getStatusesFileName() string {
  return filepath.Join(getUpgradeFilesBasePath(), "statuses")
}

func loadUpgradeFile(filePath string) bool {
  upgradeData, err := ioutil.ReadFile(filePath)
  if (err == nil) {
    UpgradeFile, err = ini.Load(upgradeData)
    if (err == nil) {
      UpgradeFile.BlockMode = false
    }
  }
  return (err == nil)
}

func loadStatusesFile(filePath string) bool {
  statusesData, err := ioutil.ReadFile(filePath)
  if (err == nil) {
    StatusesFile, err = ini.Load(statusesData)
    if (err == nil) {
      StatusesFile.BlockMode = false
    }
  }
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

func getNetCrunchServerSimpleUrl(netCrunchSettings NetCrunchServerSettings) string {
  return netCrunchSettings.Host + ":" + netCrunchSettings.Port
}

func getNetCrunchServerUrl(netCrunchSettings NetCrunchServerSettings) string {
  return netCrunchSettings.Protocol + "://" + getNetCrunchServerSimpleUrl(netCrunchSettings)
}

func createDatasourceJsonData(netCrunchSettings NetCrunchServerSettings) *simplejson.Json {
  jsonDataBuffer := simplejson.New()

  jsonDataBuffer.Set("simpleUrl", getNetCrunchServerSimpleUrl(netCrunchSettings))
  jsonDataBuffer.Set("isSSL", (strings.Compare(strings.ToUpper(netCrunchSettings.Protocol), "HTTPS") == 0))
  jsonDataBuffer.Set("user", netCrunchSettings.User)
  jsonDataBuffer.Set("password", netCrunchSettings.Password)

  return jsonDataBuffer
}

func getDefaultNetCrunchDataSource(netCrunchSettings NetCrunchServerSettings) models.DataSource {
  jsonDataBuffer := createDatasourceJsonData(netCrunchSettings)

  return models.DataSource {
    Name:               "NetCrunch",
    Type:               models.DS_NETCRUNCH,
    Access:             models.DS_ACCESS_PROXY,
    Url:                getNetCrunchServerUrl(netCrunchSettings),
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

func getDataSourceByName(datasourceName string, orgID int64) (*models.DataSource, bool) {
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
    JsonData:          datasource.JsonData,
  }
  return (bus.Dispatch(&command) == nil)
}

func updateDataSource(datasource *models.DataSource, orgId int64) bool {
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
    JsonData:          datasource.JsonData,
  }
  return (bus.Dispatch(&command) == nil)
}

func updateNetCrunchDefaultDatasource(netCrunchSettings NetCrunchServerSettings, orgId int64) bool {
  datasource, found := getDataSourceByName("NetCrunch", orgId)

  if found {
    datasource.Url = getNetCrunchServerUrl(netCrunchSettings)
    datasource.JsonData = createDatasourceJsonData(netCrunchSettings)
    return updateDataSource(datasource, orgId)
  } else {
    datasource := getDefaultNetCrunchDataSource(netCrunchSettings)
    return addDataSource(datasource, orgId)
  }
}

func getOrgs () ([]*models.OrgDTO, bool) {
  query := models.SearchOrgsQuery {
    Query: "",
    Name:  "",
    Page:  0,
    Limit: 1000,
  }

  err := bus.Dispatch(&query);
  return query.Result, (err == nil)
}

func updateNetCrunchDefaultDatasources(netCrunchSettings NetCrunchServerSettings) bool {

  result := true
  orgs, found := getOrgs()

  if found {
    for index := range orgs {
      if (updateNetCrunchDefaultDatasource(netCrunchSettings, orgs[index].Id) == false) {
        result = false;
      }
    }
  }
  return result
}

func getNetCrunchPluginByOrg(orgId int64) (*models.PluginSetting, bool) {
  query := models.GetPluginSettingByIdQuery {
    PluginId: NETCRUNCH_APP_PLUGIN_ID,
    OrgId: orgId,
  }

  err := bus.Dispatch(&query)
  return query.Result, (err == nil)
}

func enableNetCrunchPluginForOrg(orgId int64) bool {
  command := models.UpdatePluginSettingCmd {
    PluginId:      NETCRUNCH_APP_PLUGIN_ID,
    OrgId:         orgId,
    Enabled:       true,
    Pinned:        true,
  }

  return (bus.Dispatch(&command) == nil)
}

func writeVersionFile(fileName string) bool {
  version := []byte(setting.BuildVersion + "\n")
  return (ioutil.WriteFile(fileName, version, 0644) == nil)
}

func writeStatusesFile(fileName string, statuses *ini.File) bool {
  return (statuses.SaveTo(fileName) == nil)
}

func removeFile(fileName string) bool {
  err := os.Remove(fileName)
  return (err == nil)
}

func upgradeToGC92(VersionFileName string) (bool, error) {
  UPGRADE_ERROR_MSG := "Upgrade error"
  UpgradeFileName := getUpgradeFileName()
  UpgradeMarkerFileName := getUpgradeMarkerFileName()
  uLog := log.New("GrafCrunch upgrader")

  if (setting.PathExists(UpgradeFileName)) {
    if (loadUpgradeFile(UpgradeFileName)) {
      if (!setting.PathExists(VersionFileName)) {
        netCrunchSettings, err := readNetCrunchServerSettings()
        if (err == nil) {
          if (updateNetCrunchDefaultDatasources(netCrunchSettings) &&
              writeVersionFile(VersionFileName) && removeFile(UpgradeFileName)) {
            uLog.Info("Upgrade successful to 9.2")
            if (setting.PathExists(UpgradeMarkerFileName)) {
              SetInitializationSuccess()
              removeFile(UpgradeMarkerFileName)
            }
            return true, nil
          } else {
            uLog.Info(UPGRADE_ERROR_MSG)
            return false, errors.New(UPGRADE_ERROR_MSG)
          }
        } else {
          uLog.Info(UPGRADE_ERROR_MSG)
          return false, errors.New(UPGRADE_ERROR_MSG)
        }
      }
    } else {
      uLog.Info(UPGRADE_ERROR_MSG)
      return false, errors.New(UPGRADE_ERROR_MSG)
    }
  }

  return false, nil
}

func upgradeToGC94() {
}

func initNetCrunchPlugin() {
  pLog := log.New("plugins")

  if netCrunchPlugin, exist := plugins.Plugins[NETCRUNCH_APP_PLUGIN_ID]; exist {
    netCrunchPlugin.IsCorePlugin = true

    if orgs, found := getOrgs(); found {
      for index := range orgs {
        pluginSetting, err := getNetCrunchPluginByOrg(orgs[index].Id)

        if (!err && (pluginSetting == nil)) {
          enableNetCrunchPluginForOrg(orgs[index].Id)
          pLog.Info("Enabling NetCrunch Plugin for " + orgs[index].Name)
        }
      }
    }
  }
}

func upgrade() {
  VersionFileName := getVersionFileName()
  upgraded, err := upgradeToGC92(VersionFileName)

  if (err == nil) {
    if (upgraded == true) {
      upgradeToGC94()
    } else {
      // Read previous version
      // Perform upgrade
      initNetCrunchPlugin()
    }
    writeVersionFile(VersionFileName)
  }
}

func CheckInitializationSuccess() (bool, error) {
  key, err := StatusesFile.Section("Initialization").GetKey("success")
  if (err == nil) {
    return key.MustBool(false), nil
  } else {
    return false, err
  }
}

func SetInitializationSuccess() bool {
  StatusesFileName := getStatusesFileName()
  successStatus, err := CheckInitializationSuccess()

  if ((err == nil) && (!successStatus)) {
    StatusesFile.Section("Initialization").NewKey("success", "true")
    return writeStatusesFile(StatusesFileName, StatusesFile)
  }
  return true
}

func Init() {
  StatusesFileName := getStatusesFileName()
  iLog := log.New("Initializing GrafCrunch")

  if (setting.PathExists(StatusesFileName)) {
    if (!loadStatusesFile(StatusesFileName)) {
      iLog.Info("NetCrunch: Failed to load statuses")
    }
  } else {
    DefaultStatusesFile := ini.Empty()
    DefaultStatusesFile.NewSection("Initialization")
    DefaultStatusesFile.Section("Initialization").NewKey("success", "false")
    if (writeStatusesFile(StatusesFileName, DefaultStatusesFile) &&
        loadStatusesFile(StatusesFileName)) {
      iLog.Info("NetCrunch: Statuses created")
    } else {
      iLog.Info("NetCrunch: Statuses creation error")
    }
  }

  upgrade()
}
