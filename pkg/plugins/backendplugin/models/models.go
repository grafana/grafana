// Package models contains backend plugin model related logic.
package models

import (
	"github.com/grafana/grafana/pkg/infra/log"
)

// PluginFactoryFunc factory for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, env []string) (Plugin, error)
