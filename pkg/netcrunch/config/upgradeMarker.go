package config

import (
  "path/filepath"
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/netcrunch/fileUtils"
)

func getUpgradeMarkerFilePath() string {
  return filepath.Join(fileUtils.GetGrafCrunchDataPath(), "upgrade")
}

func UpgradeMarkerFileExist() bool {
  return setting.PathExists(getUpgradeMarkerFilePath())
}

func RemoveUpgradeMarkerFile() bool {
  return fileUtils.RemoveFile(getUpgradeMarkerFilePath())
}
