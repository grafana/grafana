package commands

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/public/plugins/grafana-testdata-datasource/pkg/plugin"
	"github.com/urfave/cli/v2"
)

func serveBackendPluginCommand(context *cli.Context) error {
	pluginID := context.Args().First()
	// TODO: Fix flag reading
	// flag.Set("standalone", "true")
	log.DefaultLogger.Info("Starting plugin", "pluginId", pluginID)
	switch pluginID {
	case "testdatasource":
		if err := datasource.Manage("grafana-testdata-datasource", plugin.NewDatasource, datasource.ManageOpts{}); err != nil {
			log.DefaultLogger.Error(err.Error())
			return err
		}
		return nil
	default:
		return fmt.Errorf("missing <pluginid> (only core work now!)")
	}
}
