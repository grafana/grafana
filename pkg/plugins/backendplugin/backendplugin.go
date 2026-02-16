// Package backendplugin contains backend plugin related logic.
package backendplugin

import (
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/plugins/log"
)

// PluginFactoryFunc is a function type for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, tracer trace.Tracer, env func() []string) (Plugin, error)
