package main

import (
	"os"

	sdkplugin "github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/demo/manifest/pkg/provider"
)

func main() {
	if err := sdkplugin.Run(provider.New(), sdkplugin.WithPluginID("demo-manifest-app")); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
