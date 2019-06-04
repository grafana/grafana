package commands

import (
	"errors"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

func validateVersionInput(c utils.CommandLine) error {
	arg := c.Args().First()
	if arg == "" {
		return errors.New("please specify plugin to list versions for")
	}

	return nil
}

func listversionsCommand(c utils.CommandLine) error {
	if err := validateVersionInput(c); err != nil {
		return err
	}

	pluginToList := c.Args().First()

	plugin, err := s.GetPlugin(pluginToList, c.GlobalString("repo"))
	if err != nil {
		return err
	}

	for _, i := range plugin.Versions {
		logger.Infof("%v\n", i.Version)
	}

	return nil
}
