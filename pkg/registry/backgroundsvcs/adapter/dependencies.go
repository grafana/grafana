package adapter

import (
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/provisioning"
)

const (
	// PluginStore is the module name for the plugin store service.
	PluginStore = pluginstore.ServiceName

	// PluginInstaller is the module name for the plugin installer service.
	PluginInstaller = plugininstaller.ServiceName

	// Provisioning is the module name for the provisioning service.
	Provisioning = provisioning.ServiceName

	// Tracing is the module name for the tracing service.
	Tracing = tracing.ServiceName

	// GrafanaAPIServer is the module name for the embedded Grafana API server service.
	GrafanaAPIServer = modules.GrafanaAPIServer

	// BackgroundServices is the module name for the background services module.
	// This module is an alias for any background service that is not explicitly listed in the dependency map.
	BackgroundServices = "background-services"

	// Core is the module name for the core module.
	// This module is an alias for a set of service dependencies that must be running before most other services can start.
	Core = "core"

	// FixedRolesLoader is the module name for the fixed roles loader service.
	FixedRolesLoader = accesscontrol.FixedRolesLoaderServiceName
)

// dependencyMap returns the module dependency relationships for the background service system.
// It defines the startup order and dependencies between different modules.
// Background services are automatically added as dependencies to the BackgroundServices module
// unless they are explicitly listed in this map.
func dependencyMap() map[string][]string {
	return map[string][]string{
		Tracing:            {},
		GrafanaAPIServer:   {Tracing},
		PluginStore:        {GrafanaAPIServer},
		PluginInstaller:    {PluginStore},
		FixedRolesLoader:   {PluginInstaller},
		Provisioning:       {PluginStore, PluginInstaller, FixedRolesLoader},
		Core:               {GrafanaAPIServer, PluginStore, PluginInstaller, FixedRolesLoader, Provisioning},
		BackgroundServices: {Core},
	}
}
