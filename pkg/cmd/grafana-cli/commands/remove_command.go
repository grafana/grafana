package commands

import (
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

var removePlugin func(pluginPath, id string) error = services.RemoveInstalledPlugin

func removeCommand(c utils.CommandLine) error {
	pluginPath := c.PluginDirectory()

	plugin := c.Args().First()
	if plugin == "" {
		return errors.New("Missing plugin parameter")
	}

	err := removePlugin(pluginPath, plugin)

	if err != nil {
		if strings.Contains(err.Error(), "no such file or directory") {
			return fmt.Errorf("Plugin does not exist")
		}

		return err
	}

	return nil
}
