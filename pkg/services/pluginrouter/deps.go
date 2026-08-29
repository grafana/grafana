package pluginrouter

import (
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// PluginDeps is the plugin stack this module serves through: the same
// components a Grafana server builds, minus the HTTP surface it puts in front
// of them.
//
// It is built by the wire graph rather than here -- see
// server.InitializePluginRouterDeps -- because assembling it means assembling most of
// a Grafana server, and restating that here would be a second copy of the
// server's provider set to keep in step.
type PluginDeps struct {
	// Store loads the plugins and starts their backends. It is a dskit service,
	// run as a subservice of this module so the backends stop with it.
	Store *pluginstore.Service

	// Client serves the settings subresources: health and resources.
	Client plugins.Client

	// ClientV3Loader hands out a plugin's protocol v3 client once the store has
	// loaded it. Admission, conversion and the manifest's custom routes all go
	// through it.
	ClientV3Loader v3.ClientV3Loader

	// ContextProvider builds the backend.PluginContext those calls carry.
	ContextProvider appplugin.PluginContextWrapper

	// Sources is where plugins are discovered, the same registry the store
	// loaded them from.
	Sources sources.Registry
}
