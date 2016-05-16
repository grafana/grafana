package commands

import (
	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

func upgradeCommand(c CommandLine) error {
	pluginsDir := c.GlobalString("pluginsDir")
	pluginName := c.Args().First()

	localPlugin, err := s.ReadPlugin(pluginsDir, pluginName)

	if err != nil {
		return err
	}

	v, err2 := s.GetPlugin(localPlugin.Id, c.GlobalString("repo"))

	if err2 != nil {
		return err2
	}

	if ShouldUpgrade(localPlugin.Info.Version, v) {
		s.RemoveInstalledPlugin(pluginsDir, pluginName)
		return InstallPlugin(localPlugin.Id, "", c)
	}

	log.Infof("%s %s is up to date \n", color.GreenString("✔"), localPlugin.Id)
	return nil
}
