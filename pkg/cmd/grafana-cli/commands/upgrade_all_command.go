package commands

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/hashicorp/go-version"
)

func shouldUpgrade(installed string, remote *m.Plugin) bool {
	installedVersion, err := version.NewVersion(installed)
	if err != nil {
		return false
	}

	latest := latestSupportedVersion(remote)
	latestVersion, err := version.NewVersion(latest.Version)
	if err != nil {
		return false
	}
	return installedVersion.LessThan(latestVersion)
}

func upgradeAllCommand(c utils.CommandLine) error {
	pluginsDir := c.PluginDirectory()

	localPlugins := s.GetLocalPlugins(pluginsDir)

	remotePlugins, err := c.ApiClient().ListAllPlugins(c.GlobalString("repo"))

	if err != nil {
		return err
	}

	pluginsToUpgrade := make([]m.InstalledPlugin, 0)

	for _, localPlugin := range localPlugins {
		for _, remotePlugin := range remotePlugins.Plugins {
			if localPlugin.Id == remotePlugin.Id {
				if shouldUpgrade(localPlugin.Info.Version, &remotePlugin) {
					pluginsToUpgrade = append(pluginsToUpgrade, localPlugin)
				}
			}
		}
	}

	for _, p := range pluginsToUpgrade {
		logger.Infof("Updating %v \n", p.Id)

		err := s.RemoveInstalledPlugin(pluginsDir, p.Id)
		if err != nil {
			return err
		}

		err = InstallPlugin(p.Id, "", c)
		if err != nil {
			return err
		}
	}

	return nil
}
