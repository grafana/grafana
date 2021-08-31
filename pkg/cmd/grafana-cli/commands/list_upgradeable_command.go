package commands

import (
	"errors"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/hashicorp/go-version"
)

func (cmd Command) listUpgradeableCommand(c utils.CommandLine) error {
	pluginsDir := c.PluginDirectory()

	localPlugins := services.GetLocalPlugins(pluginsDir)

	remotePlugins, err := cmd.Client.ListAllPlugins(c.String("repo"))
	if err != nil {
		return err
	}

	anythingToUpgrade := false

	for _, localPlugin := range localPlugins {
		for _, remotePlugin := range remotePlugins.Plugins {
			if localPlugin.ID != remotePlugin.ID {
				continue
			}
			if shouldUpgrade(localPlugin.Info.Version, &remotePlugin) {
				latest := latestSupportedVersion(&remotePlugin)
				latestVersion, err := version.NewVersion(latest.Version)
				if err != nil {
					return err
				}
				anythingToUpgrade = true
				logger.Infof("%v is upgradeable (%v -> %v)\n", localPlugin.ID, localPlugin.Info.Version, latestVersion)
			}
		}
	}

	if anythingToUpgrade {
		return errors.New("there are plugins to upgrade")
	} else {
		logger.Infof("%s No plugins to upgrade\n", color.GreenString("✔"))
		return nil
	}
}
