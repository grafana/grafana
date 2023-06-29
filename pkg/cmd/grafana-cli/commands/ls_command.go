package commands

import (
	"errors"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

var (
	errMissingPathFlag = errors.New("missing path flag")
	errNotDirectory    = errors.New("plugin path is not a directory")
)
var validateLsCommand = func(pluginDir string) error {
	if pluginDir == "" {
		return errMissingPathFlag
	}

	logger.Debug("plugindir: " + pluginDir + "\n")
	pluginDirInfo, err := services.IoHelper.Stat(pluginDir)
	if err != nil {
		return err
	}

	if !pluginDirInfo.IsDir() {
		return errNotDirectory
	}

	return nil
}

func lsCommand(c utils.CommandLine) error {
	pluginDir := c.PluginDirectory()
	if err := validateLsCommand(pluginDir); err != nil {
		return err
	}

	plugins := services.GetLocalPlugins(pluginDir)

	if len(plugins) > 0 {
		logger.Info("installed plugins:\n")
	} else {
		logger.Info("no installed plugins found\n")
	}

	for _, plugin := range plugins {
		logger.Infof("%s %s %s\n", plugin.Primary.JSONData.ID,
			color.YellowString("@"), plugin.Primary.JSONData.Info.Version)
	}

	return nil
}
