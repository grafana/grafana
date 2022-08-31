package commands

import (
	"context"
	"fmt"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

func (cmd Command) upgradeCommand(c utils.CommandLine) error {
	pluginsDir := c.PluginDirectory()
	pluginName := c.Args().First()

	localPlugin, err := services.ReadPlugin(pluginsDir, pluginName)

	if err != nil {
		return err
	}

	plugin, err2 := cmd.Client.GetPlugin(pluginName, c.PluginRepoURL())
	if err2 != nil {
		return err2
	}

	if shouldUpgrade(localPlugin.Info.Version, &plugin) {
		if err := services.RemoveInstalledPlugin(pluginsDir, pluginName); err != nil {
			return fmt.Errorf("failed to remove plugin '%s': %w", pluginName, err)
		}

		return installPlugin(context.Background(), pluginName, "", c)
	}

	logger.Infof("%s %s is up to date \n", color.GreenString("✔"), pluginName)
	return nil
}
