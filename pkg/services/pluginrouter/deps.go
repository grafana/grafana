package pluginrouter

import (
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
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

	// Authn is what /login signs callers in through: Grafana's own
	// authentication, against Grafana's own users.
	Authn authn.Service

	// PluginSettings reads the plugin_setting table a plugin's settings were
	// served from before unified storage, and DualWrite decides which of the
	// two actually serves them. Together they give the settings resource the
	// same dual writing a Grafana server gives it.
	PluginSettings pluginsettings.Service
	DualWrite      dualwrite.Service

	// AuthnRegistration is what registers the clients Authn authenticates
	// with, the form client among them. Constructing it is the registration --
	// nothing reads the value -- so it has to be asked for explicitly or wire
	// prunes it and the form client is never configured. The background
	// services registry holds it for the same reason.
	AuthnRegistration authnimpl.Registration
}
