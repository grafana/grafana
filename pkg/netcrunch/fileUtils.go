package netcrunch

import (
  "strings"
  "io/ioutil"
  "path/filepath"
  "gopkg.in/ini.v1"
  "github.com/grafana/grafana/pkg/setting"
)

func getGrafCrunchDataPath() string {
  GrafCrunchDataBasePath := setting.Cfg.Section("paths").Key("data").String()

  if (!filepath.IsAbs(GrafCrunchDataBasePath)) {
    GrafCrunchDataBasePath = filepath.Join(setting.HomePath, GrafCrunchDataBasePath)
  }
  return GrafCrunchDataBasePath
}

func loadFile (filePath string) ([]byte, bool) {
  if (setting.PathExists(filePath)) {
    content, err := ioutil.ReadFile(filePath)
    if (err == nil) {
      return content, nil
    }
  }
  return nil, true
}

func loadIniFile(filePath string) (*ini.File, bool) {
  var (iniFile *ini.File)

  content, err := loadFile(filePath)
  if (err == nil) {
    iniFile, err = ini.Load(content)
    if (err == nil) {
      iniFile.BlockMode = false
      return iniFile, nil
    }
  }

  return nil, true
}

func loadTxtFile(filePath string) (string, error) {
  content, err := loadFile(filePath)
  if (err == nil) {
    return strings.TrimSpace(string(content))
  }
  return "", true
}
