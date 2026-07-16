package marketplacelicensing

import (
	"path/filepath"
	"strings"
)

func LicensePath(directory, pluginID string) (string, bool) {
	if pluginID == "" || pluginID == "." || pluginID == ".." || strings.Contains(pluginID, "\x00") ||
		strings.ContainsAny(pluginID, "/\\:") || filepath.IsAbs(pluginID) || filepath.Base(pluginID) != pluginID {
		return "", false
	}

	absDirectory, err := filepath.Abs(directory)
	if err != nil {
		return "", false
	}
	absDirectory = filepath.Clean(absDirectory)
	licensePath := filepath.Join(absDirectory, "license-"+pluginID+".jwt")
	if filepath.Dir(licensePath) != absDirectory {
		return "", false
	}

	return licensePath, true
}
