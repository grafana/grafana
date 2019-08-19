package utils

import (
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"golang.org/x/xerrors"
)

func GetGrafanaPluginDir(currentOS string) string {
	if rootPath, ok := tryGetRootForDevEnvironment(); ok {
		return filepath.Join(rootPath, "data/plugins")
	}

	return returnOsDefault(currentOS)
}

// getGrafanaRoot tries to get root of directory when developing grafana ie repo root. It is not perfect it just
// checks what is the binary path and tries to guess based on that but if it is not running in dev env you get a bogus
// path back.
func getGrafanaRoot() (string, error) {
	ex, err := os.Executable()
	if err != nil {
		return "", xerrors.New("Failed to get executable path")
	}
	exPath := filepath.Dir(ex)
	_, last := path.Split(exPath)
	if last == "bin" {
		// In dev env the executable for current platform is created in 'bin/' dir
		return filepath.Join(exPath, ".."), nil
	}

	// But at the same time there are per platform directories that contain the binaries and can also be used.
	return filepath.Join(exPath, "../.."), nil
}

// tryGetRootForDevEnvironment returns root path if we are in dev environment. It checks if conf/defaults.ini exists
// which should only exist in dev. Second param is false if we are not in dev or if it wasn't possible to determine it.
func tryGetRootForDevEnvironment() (string, bool) {
	rootPath, err := getGrafanaRoot()
	if err != nil {
		logger.Error("Could not get executable path. Assuming non dev environment.", err)
		return "", false
	}

	devenvPath := filepath.Join(rootPath, "devenv")

	_, err = os.Stat(devenvPath)
	if err != nil {
		return "", false
	}

	return rootPath, true
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
