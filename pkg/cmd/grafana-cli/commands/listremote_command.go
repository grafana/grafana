package commands

import (
	"github.com/wangy1931/grafana/pkg/cmd/grafana-cli/log"
	s "github.com/wangy1931/grafana/pkg/cmd/grafana-cli/services"
)

func listremoteCommand(c CommandLine) error {
	plugin, err := s.ListAllPlugins(c.GlobalString("repo"))

	if err != nil {
		return err
	}

	for _, i := range plugin.Plugins {
		pluginVersion := ""
		if len(i.Versions) > 0 {
			pluginVersion = i.Versions[0].Version
		}

		log.Infof("id: %v version: %s\n", i.Id, pluginVersion)
	}

	return nil
}
