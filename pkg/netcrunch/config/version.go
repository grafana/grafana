package config

import (
  "errors"
  "strings"
  "io/ioutil"
  "path/filepath"
  "github.com/hashicorp/go-version"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/setting"
  "github.com/grafana/grafana/pkg/netcrunch/fileUtils"
)

func formatVersion(ver string) string {
  if (strings.Count(ver, ".") == 3) {
    return ver[0:strings.LastIndex(ver, ".")]
  }
  return ver
}

func getVersionFilePath() string {
  return filepath.Join(fileUtils.GetGrafCrunchDataPath(), "version")
}

func CompareVersions(version1 string, version2 string) (int64, error) {
  ver1, err1 := version.NewVersion(formatVersion(version1))
  ver2, err2 := version.NewVersion(formatVersion(version2))

  if ((err1 != nil) || (err2 != nil)) {
    return 0, errors.New("Version error")
  }

  if ver1.LessThan(ver2) {
    return -1, nil
  } else if ver1.GreaterThan(ver2) {
    return 1, nil
  }
  return 0, nil
}

func VersionFileExist() bool {
  return setting.PathExists(getVersionFilePath())
}

func ReadVersionFile() (string, error) {
  vLog := log.New("GrafCrunch version loader")
  version, err := fileUtils.LoadTxtFile(getVersionFilePath())

  if (err != nil) {
    vLog.Info("Failed to load GrafCrunch version")
    return nil, err;
  }

  return version, err
}

func WriteVersionFile() bool {
  version := []byte(setting.BuildVersion + "\n")
  return (ioutil.WriteFile(getVersionFilePath(), version, 0644) == nil)
}
