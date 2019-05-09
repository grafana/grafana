package utils

import (
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
)

func GetGrafanaPluginDir(currentOS string) string {
	//currentOS := runtime.GOOS

	if isDevenvironment() {
		return "../data/plugins"
	}

	return returnOsDefault(currentOS)
}

func isDevenvironment() bool {
	// if ../conf/defaults.ini exists, grafana is not installed as package
	// that its in development environment.
	ex, err := os.Executable()
	if err != nil {
		logger.Error("Could not get executable path. Assuming non dev environment.")
		return false
	}
	exPath := filepath.Dir(ex)
	defaultsPath := filepath.Join(exPath, "../conf/defaults.ini")
	_, err = os.Stat(defaultsPath)
	return err == nil
}

func returnOsDefault(currentOs string) string {
	switch currentOs {
	case "windows":
		return "../data/plugins"
	case "darwin":
		return "/usr/local/var/lib/grafana/plugins"
	case "freebsd":
		return "/var/db/grafana/plugins"
	case "openbsd":
		return "/var/grafana/plugins"
	default: //"linux"
		return "/var/lib/grafana/plugins"
	}
}
