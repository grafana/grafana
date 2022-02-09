// Package backendplugin contains backend plugin related logic.
package backendplugin

import (
	"github.com/grafana/grafana/pkg/infra/log"
)

// PluginFactoryFunc is a function type for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, env []string) (Plugin, error)
