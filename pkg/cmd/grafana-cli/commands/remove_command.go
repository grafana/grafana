package commands

import (
	"errors"

	"github.com/wangy1931/grafana/pkg/cmd/grafana-cli/log"
	m "github.com/wangy1931/grafana/pkg/cmd/grafana-cli/models"
	services "github.com/wangy1931/grafana/pkg/cmd/grafana-cli/services"
)

var getPluginss func(path string) []m.InstalledPlugin = services.GetLocalPlugins
var removePlugin func(pluginPath, id string) error = services.RemoveInstalledPlugin

func removeCommand(c CommandLine) error {
	pluginPath := c.GlobalString("pluginsDir")
	localPlugins := getPluginss(pluginPath)

	log.Info("remove!\n")

	plugin := c.Args().First()
	log.Info("plugin: " + plugin + "\n")
	if plugin == "" {
		return errors.New("Missing plugin parameter")
	}

	log.Infof("plugins : \n%v\n", localPlugins)

	for _, p := range localPlugins {
		if p.Id == c.Args().First() {
			log.Infof("removing plugin %s", p.Id)
			removePlugin(pluginPath, p.Id)
		}
	}

	return nil
}
