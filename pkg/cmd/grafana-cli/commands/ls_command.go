package commands

import (
	"errors"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

var ls_getPlugins func(path string) []models.InstalledPlugin = services.GetLocalPlugins

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

func (cmd Command) lsCommand(c utils.CommandLine) error {
	pluginDir := c.PluginDirectory()
	if err := validateLsCommand(pluginDir); err != nil {
		return err
	}

	plugins := ls_getPlugins(pluginDir)

	if len(plugins) > 0 {
		logger.Info("installed plugins:\n")
	} else {
		logger.Info("no installed plugins found\n")
	}

	for _, plugin := range plugins {
		logger.Infof("%s %s %s\n", plugin.ID, color.YellowString("@"), plugin.Info.Version)
	}

	return nil
}
