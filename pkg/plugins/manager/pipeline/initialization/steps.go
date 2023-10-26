package initialization

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// BackendClientInit implements an InitializeFunc for initializing a backend plugin process.
//
// It uses the envvars.Provider to retrieve the environment variables required for the plugin and the plugins.BackendFactoryProvider
// to get fetch backend factory, which is used to form a connection to the backend plugin process.
//
// Note: This step does not start the backend plugin process. Please see BackendClientStarter for starting the backend plugin process.
type BackendClientInit struct {
	clientRegistry client.Registry
	log            log.Logger
}

// BackendClientInitStep returns a new InitializeFunc for registering a backend plugin process.
func BackendClientInitStep(clientRegistry client.Registry) InitializeFunc {
	return newBackendProcessRegistration(clientRegistry).Initialize
}

func newBackendProcessRegistration(clientRegistry client.Registry) *BackendClientInit {
	return &BackendClientInit{
		clientRegistry: clientRegistry,
		log:            log.New("plugins.backend.registration"),
	}
}

// Initialize will initialize a backend plugin client, if the plugin is a backend plugin.
func (b *BackendClientInit) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.Backend {
		_, err := b.clientRegistry.Register(ctx, p)
		if err != nil {
			return nil, err
		}
	}
	return p, nil
}

// BackendClientStarter implements an InitializeFunc for starting a backend plugin process.
type BackendClientStarter struct {
	processManager process.Manager
	log            log.Logger
}

// BackendProcessStartStep returns a new InitializeFunc for starting a backend plugin process.
//func BackendProcessStartStep(processManager process.Manager) InitializeFunc {
//	return newBackendProcessStarter(processManager).Start
//}
//
//func newBackendProcessStarter(processManager process.Manager) *BackendClientStarter {
//	return &BackendClientStarter{
//		processManager: processManager,
//		log:            log.New("plugins.backend.start"),
//	}
//}
//
//// Start will start the backend plugin process.
//func (b *BackendClientStarter) Start(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
//	if err := b.processManager.Start(ctx, p); err != nil {
//		b.log.Error("Could not start plugin", "pluginId", p.ID, "error", err)
//		return nil, err
//	}
//	return p, nil
//}

// PluginRegistration implements an InitializeFunc for registering a plugin with the plugin registry.
type PluginRegistration struct {
	pluginRegistry registry.Service
	log            log.Logger
}

// PluginRegistrationStep returns a new InitializeFunc for registering a plugin with the plugin registry.
func PluginRegistrationStep(pluginRegistry registry.Service) InitializeFunc {
	return newPluginRegistration(pluginRegistry).Initialize
}

func newPluginRegistration(pluginRegistry registry.Service) *PluginRegistration {
	return &PluginRegistration{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugins.registration"),
	}
}

// Initialize registers the plugin with the plugin registry.
func (r *PluginRegistration) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.pluginRegistry.Add(ctx, p); err != nil {
		r.log.Error("Could not register plugin", "pluginId", p.ID, "error", err)
		return nil, err
	}
	if !p.IsCorePlugin() {
		r.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return p, nil
}
