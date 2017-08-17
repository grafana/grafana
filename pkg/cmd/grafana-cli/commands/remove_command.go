package commands

import (
	"errors"

	"fmt"
	m "github.com/wangy1931/grafana/pkg/cmd/grafana-cli/models"
	services "github.com/wangy1931/grafana/pkg/cmd/grafana-cli/services"
)

var getPluginss func(path string) []m.InstalledPlugin = services.GetLocalPlugins
var removePlugin func(pluginPath, id string) error = services.RemoveInstalledPlugin

func removeCommand(c CommandLine) error {
	pluginPath := c.GlobalString("pluginsDir")
	localPlugins := getPluginss(pluginPath)

	plugin := c.Args().First()
	if plugin == "" {
		return errors.New("Missing plugin parameter")
	}

	for _, p := range localPlugins {
		if p.Id == c.Args().First() {
			removePlugin(pluginPath, p.Id)
			return nil
		}
	}

	return fmt.Errorf("Could not find plugin named %s", c.Args().First())
}
