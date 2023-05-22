package commands

import (
	"context"
	"fmt"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

func upgradeCommand(c utils.CommandLine) error {
	ctx := context.Background()
	pluginsDir := c.PluginDirectory()
	pluginID := c.Args().First()

	localPlugin, err := services.GetLocalPlugin(pluginsDir, pluginID)
	if err != nil {
		return err
	}

	plugin, err := services.GetPluginInfoFromRepo(pluginID, c.PluginRepoURL())
	if err != nil {
		return err
	}

	if shouldUpgrade(localPlugin, plugin) {
		if err = uninstallPlugin(ctx, pluginID, c); err != nil {
			return fmt.Errorf("failed to remove plugin '%s': %w", pluginID, err)
		}

		err = installPlugin(ctx, pluginID, "", c)
		if err == nil {
			logRestartNotice()
		}
		return err
	}

	logger.Infof("%s %s is up to date \n", color.GreenString("✔"), pluginID)
	return nil
}
