package commands

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

// listRemoteCommand prints out all plugins in the remote repo with latest version supported on current platform.
// If there are no supported versions for plugin it is skipped.
func listRemoteCommand(c utils.CommandLine) error {
	plugin, err := c.ApiClient().ListAllPlugins(c.RepoDirectory())

	if err != nil {
		return err
	}

	for _, plugin := range plugin.Plugins {
		if len(plugin.Versions) > 0 {
			ver := latestSupportedVersion(&plugin)
			if ver != nil {
				logger.Infof("id: %v version: %s\n", plugin.Id, ver.Version)
			}
		}

	}

	return nil
}
