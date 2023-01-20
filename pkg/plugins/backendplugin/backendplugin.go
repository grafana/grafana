// Package backendplugin contains backend plugin related logic.
package backendplugin

import (
	"github.com/grafana/grafana/pkg/plugins/logger"
)

// PluginFactoryFunc is a function type for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger logger.Logger, env []string) (Plugin, error)
