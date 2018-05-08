package commands

import (
	"errors"
	"fmt"
	"strings"

	services "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

var removePlugin func(pluginPath, id string) error = services.RemoveInstalledPlugin

func removeCommand(c CommandLine) error {
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
