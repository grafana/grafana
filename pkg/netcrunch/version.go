package netcrunch

import (
  "errors"
  "strings"
  "github.com/hashicorp/go-version"
)

func formatVersion(ver string) string {
  if (strings.Count(ver, ".") == 3) {
    return ver[0:strings.LastIndex(ver, ".")]
  }
  return ver
}

func compareVersions(version1 string, version2 string) (int64, error) {
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

func readVersionFile(filePath string) (string, error) {
  return loadTxtFile(filePath)
}
