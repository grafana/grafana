package fileUtils

import (
  "os"
  "strings"
  "errors"
  "io/ioutil"
  "path/filepath"
  "gopkg.in/ini.v1"
  "github.com/grafana/grafana/pkg/setting"
)

func GetGrafCrunchDataPath() string {
  GrafCrunchDataBasePath := setting.Cfg.Section("paths").Key("data").String()

  if (!filepath.IsAbs(GrafCrunchDataBasePath)) {
    GrafCrunchDataBasePath = filepath.Join(setting.HomePath, GrafCrunchDataBasePath)
  }
  return GrafCrunchDataBasePath
}

func LoadFile (filePath string) ([]byte, error) {
  if (setting.PathExists(filePath)) {
    content, err := ioutil.ReadFile(filePath)
    if (err == nil) {
      return content, nil
    }
  }
  return nil, errors.New("File loading error: " + filePath)
}

func LoadIniFile(filePath string) (*ini.File, error) {
  var (iniFile *ini.File)

  content, err := LoadFile(filePath)
  if (err == nil) {
    iniFile, err = ini.Load(content)
    if (err == nil) {
      iniFile.BlockMode = false
      return iniFile, nil
    }
  }

  return nil, errors.New("File loading error: " + filePath)
}

func LoadTxtFile(filePath string) (string, error) {
  content, err := LoadFile(filePath)
  if (err == nil) {
    return strings.TrimSpace(string(content)), nil
  }
  return "", errors.New("File loading error: " + filePath)
}

func SaveIniFile(iniFile *ini.File, filePath string) bool {
  return (iniFile.SaveTo(filePath) == nil)
}

func RemoveFile(fileName string) bool {
  err := os.Remove(fileName)
  return (err == nil)
}
