package commands

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

// listRemoteCommand prints out all plugins in the remote repo with latest version supported on current platform.
// If there are no supported versions for plugin it is skipped.
func listRemoteCommand(c utils.CommandLine) error {
	plugin, err := services.ListAllPlugins(c.PluginRepoURL())
	if err != nil {
		return err
	}

	for _, p := range plugin.Plugins {
		plugin := p
		if len(plugin.Versions) > 0 {
			ver := latestSupportedVersion(&plugin)
			if ver != nil {
				logger.Infof("id: %v version: %s\n", plugin.ID, ver.Version)
			}
		}
	}

	return nil
}
