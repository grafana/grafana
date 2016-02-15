package commands

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

func listremoteCommand(c CommandLine) error {
	plugin, err := s.ListAllPlugins()

	if err != nil {
		return err
	}

	for _, i := range plugin.Plugins {
		log.Infof("id: %v version:\n", i.Id)
	}

	return nil
}
