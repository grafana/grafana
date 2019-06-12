package commands

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/hashicorp/go-version"
)

func ShouldUpgrade(installed string, remote m.Plugin) bool {
	installedVersion, err1 := version.NewVersion(installed)

	if err1 != nil {
		return false
	}

	for _, v := range remote.Versions {
		remoteVersion, err2 := version.NewVersion(v.Version)

		if err2 == nil {
			if installedVersion.LessThan(remoteVersion) {
				return true
			}
		}
	}

	return false
}

func upgradeAllCommand(c utils.CommandLine) error {
	pluginsDir := c.PluginDirectory()

	localPlugins := s.GetLocalPlugins(pluginsDir)

	remotePlugins, err := s.ListAllPlugins(c.GlobalString("repo"))

	if err != nil {
		return err
	}

	pluginsToUpgrade := make([]m.InstalledPlugin, 0)

	for _, localPlugin := range localPlugins {
		for _, remotePlugin := range remotePlugins.Plugins {
			if localPlugin.Id == remotePlugin.Id {
				if ShouldUpgrade(localPlugin.Info.Version, remotePlugin) {
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
