package commands

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

var ls_getPlugins func(path string) []m.InstalledPlugin = s.GetLocalPlugins

var validateLsCommmand = func(pluginDir string) error {
	if pluginDir == "" {
		return errors.New("missing path flag")
	}

	log.Debug("plugindir: " + pluginDir + "\n")
	pluginDirInfo, err := s.IoHelper.Stat(pluginDir)

	if err != nil {
		return fmt.Errorf("error: %s", err)
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

	plugins := ls_getPlugins(pluginDir)

	if len(plugins) > 0 {
		log.Info("installed plugins:\n")
	}

	for _, plugin := range plugins {
		log.Infof("%s @ %s \n", plugin.Id, plugin.Info.Version)
	}

	return nil
}
