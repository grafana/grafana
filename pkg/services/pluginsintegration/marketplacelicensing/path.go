package marketplacelicensing

import (
	"path/filepath"
	"strings"
)

// LicensePath returns the path to a plugin's marketplace license when its ID is safe.
// If the path is not safe, the function returns an empty string and false.
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
