package plugins

import (
	"fmt"
	"runtime"
	"strings"
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
