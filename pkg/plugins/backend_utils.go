package plugins

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

func ComposePluginStartCommand(executable string) string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}

	return fmt.Sprintf("%s_%s_%s%s", executable, os, strings.ToLower(arch), extension)
}

func ComposeRendererStartCommand() string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}

	return fmt.Sprintf("%s_%s_%s%s", "plugin_start", os, strings.ToLower(arch), extension)
}

func CoreDataSourcePathResolver(cfg *setting.Cfg, pluginRootDirName string) PluginPathResolver {
	return func() (string, error) {
		// override mismatch cloud monitoring plugin
		if pluginRootDirName == "stackdriver" {
			pluginRootDirName = "cloud-monitoring"
		}

		return filepath.Join(cfg.StaticRootPath, "app/plugins/datasource", pluginRootDirName), nil
	}
}
