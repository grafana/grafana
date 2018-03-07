package config

import (
  "path/filepath"
  "gopkg.in/ini.v1"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/netcrunch/fileUtils"
)

func getStatusesFilePath() string {
  return filepath.Join(fileUtils.GetGrafCrunchDataPath(), "statuses")
}

func getDefaultStatusesFile() (*ini.File) {
  DefaultStatuses := ini.Empty()
  DefaultStatuses.NewSection("Initialization")
  DefaultStatuses.Section("Initialization").NewKey("success", "false")
  return DefaultStatuses
}

func CreateDefaultStatusesFile() (bool) {
  iLog := log.New("GrafCrunch statuses creator")
  statusesFilePath := getStatusesFilePath()

  if (!setting.PathExists(statusesFilePath)) {
    if (!fileUtils.SaveIniFile(getDefaultStatusesFile(), statusesFilePath)) {
      iLog.Info("Statuses creation error")
      return false;
    }
    iLog.Info("Statuses created")
  }

  return true
}

func loadStatusesFile() (*ini.File, error) {
  iLog := log.New("GrafCrunch statuses loader")
  statusesFile, err := fileUtils.LoadIniFile(getStatusesFilePath())

  if (err != nil) {
    iLog.Info("Failed to load statuses")
    return nil, err;
  }

  return statusesFile, err
}

// The first successful user login is identified by "success" property

func CheckInitializationSuccess() (bool, error) {
  statusesFile, err := loadStatusesFile()

  if (err == nil) {
    key, err := statusesFile.Section("Initialization").GetKey("success")
    if (err == nil) {
      return key.MustBool(false), nil
    }
  }

  return false, err
}

func SetInitializationSuccess() bool {
  success, err := CheckInitializationSuccess()

  if ((err == nil) && (!success)) {
    statusesFile, err := loadStatusesFile()
    if (err == nil) {
      statusesFile.Section("Initialization").NewKey("success", "true")
      return fileUtils.SaveIniFile(statusesFile, getStatusesFilePath())
    }
    return false
  }

  return true
}
