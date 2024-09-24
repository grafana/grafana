// Package backendplugin contains backend plugin related logic.
package backendplugin

import (
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// PluginFactoryFunc is a function type for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, tracer tracing.Tracer, env func() []string) (Plugin, error)
