package commands

import (
	"errors"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

var ls_getPlugins func(path string) []m.InstalledPlugin = s.GetLocalPlugins

var validateLsCommmand = func(pluginDir string) error {
	if pluginDir == "" {
		return errors.New("missing path flag")
	}

	log.Info("plugindir: " + pluginDir + "\n")
	pluginDirInfo, err := s.IoHelper.Stat(pluginDir)

	if err != nil {
		return errors.New("missing path flag")
	}

	if pluginDirInfo.IsDir() == false {
		return errors.New("plugin path is not a directory")
	}

	return nil
}

func lsCommand(c CommandLine) error {
	pluginDir := c.GlobalString("path")
	if err := validateLsCommmand(pluginDir); err != nil {
		return err
	}

	for _, plugin := range ls_getPlugins(pluginDir) {
		log.Infof("plugin: %s @ %s \n", plugin.Name, plugin.Info.Version)
	}

	return nil
}
