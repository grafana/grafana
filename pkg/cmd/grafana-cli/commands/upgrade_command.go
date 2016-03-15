package commands

import (
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

func upgradeCommand(c CommandLine) error {
	pluginDir := c.GlobalString("path")
	pluginName := c.Args().First()

	localPlugin, err := s.ReadPlugin(pluginDir, pluginName)

	if err != nil {
		return err
	}

	remotePlugins, err2 := s.ListAllPlugins(c.GlobalString("repo"))

	if err2 != nil {
		return err2
	}

	for _, v := range remotePlugins.Plugins {
		if localPlugin.Id == v.Id {
			if ShouldUpgrade(localPlugin.Info.Version, v) {
				s.RemoveInstalledPlugin(pluginDir, pluginName)
				return InstallPlugin(localPlugin.Id, "", c)
			}
		}
	}

	return nil
}
