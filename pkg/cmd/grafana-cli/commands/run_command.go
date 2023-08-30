package commands

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

func hostPluginCommand(c utils.CommandLine) error {
	pluginID := c.Args().First()
	var opts *backend.ServeOpts
	switch pluginID {
	case "testdatasource":
		opts = testdatasource.NewBackendServerOpts()
	default:
		return fmt.Errorf("missing pluginid (only testdatasource works now!)")
	}
	return backend.Serve(*opts)
}
