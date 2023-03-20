package pluginmod

import (
	"github.com/grafana/grafana/pkg/plugins"
)

type PluginManager interface {
	plugins.Installer
	plugins.Store
	plugins.Client
	plugins.FileSystem

	plugins.RendererManager
	plugins.SecretsPluginManager
	plugins.StaticRouteResolver
	plugins.ErrorResolver
}
