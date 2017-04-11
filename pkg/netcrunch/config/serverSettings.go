package config

import (
  "errors"
  "gopkg.in/ini.v1"
  "path/filepath"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/netcrunch/fileUtils"
)

type NetCrunchServerSettings struct {
  Host        string  `json:"host"`
  Port        string  `json:"port"`
  Protocol    string  `json:"protocol"`

  User        string  `json:"user"`
  Password    string  `json:"password"`
}

func getServerSettingsFilePath() string {
  return filepath.Join(fileUtils.GetGrafCrunchDataPath(), "setup.ini")
}

func ServerSettingsFileExist() bool {
  return setting.PathExists(getServerSettingsFilePath())
}

func readServerSettings() (*ini.File, error) {
  iLog := log.New("GrafCrunch settings loader")
  settingsFile, err := fileUtils.LoadIniFile(getServerSettingsFilePath())

  if (err != nil) {
    iLog.Info("Failed to load settigs")
    return nil, err;
  }

  return settingsFile, err
}

func ReadNetCrunchServerSettingsFile() (NetCrunchServerSettings, error) {
  var (
    settingsFile *ini.File
    NCServerSettings NetCrunchServerSettings
  )

  settingsFile, err := readServerSettings()
  if (err == nil) {
    section, err := settingsFile.GetSection("netcrunch-server")
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

  return NCServerSettings, errors.New("Failed to load settigs")
}

func RemoveServerSettingsFile() bool {
  return fileUtils.RemoveFile(getServerSettingsFilePath())
}
