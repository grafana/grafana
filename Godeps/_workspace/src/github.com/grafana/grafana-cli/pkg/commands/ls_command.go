package commands

import (
	"errors"
	"github.com/grafana/grafana-cli/pkg/log"
	m "github.com/grafana/grafana-cli/pkg/models"
	s "github.com/grafana/grafana-cli/pkg/services"
)

var getPlugins func(path string) []m.InstalledPlugin

var GetStat m.IoUtil

func init() {
	getPlugins = s.GetLocalPlugins
	GetStat = s.IoUtil
}

func validateCommand(pluginDir string) error {
	if pluginDir == "" {
		return errors.New("missing path flag")
	}
    
	log.Info("plugindir: " + pluginDir + "\n")
	pluginDirInfo, err := GetStat.Stat(pluginDir)

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
	if err := validateCommand(pluginDir); err != nil {
		return err
	}

	for _, plugin := range getPlugins(pluginDir) {
		log.Infof("plugin: %s @ %s \n", plugin.Name, plugin.Info.Version)
	}

	return nil
}
