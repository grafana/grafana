package commands

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
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

func upgradeAllCommand(c CommandLine) error {
	pluginDir := c.GlobalString("path")

	localPlugins := s.GetLocalPlugins(pluginDir)

	remotePlugins, err := s.ListAllPlugins()

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
		log.Infof("Upgrading %v \n", p.Id)

		s.RemoveInstalledPlugin(pluginDir, p.Id)
		InstallPlugin(p.Id, pluginDir, "")
	}

	return nil
}
