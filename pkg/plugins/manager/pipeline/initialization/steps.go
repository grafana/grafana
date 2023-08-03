package initialization

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// BackendClientInit implements an InitializeFunc for initializing a backend plugin process.
//
// It uses the envvars.Provider to retrieve the environment variables required for the plugin and the plugins.BackendFactoryProvider
// to get fetch backend factory, which is used to form a connection to the backend plugin process.
//
// Note: This step does not start the backend plugin process.
type BackendClientInit struct {
	envVarProvider  envvars.Provider
	backendProvider plugins.BackendFactoryProvider
	log             log.Logger
}

// NewBackendClientInitStep returns a new InitializeFunc for registering a backend plugin process.
func NewBackendClientInitStep(envVarProvider envvars.Provider,
	backendProvider plugins.BackendFactoryProvider) InitializeFunc {
	return newBackendProcessRegistration(envVarProvider, backendProvider).Initialize
}

func newBackendProcessRegistration(envVarProvider envvars.Provider,
	backendProvider plugins.BackendFactoryProvider) *BackendClientInit {
	return &BackendClientInit{
		backendProvider: backendProvider,
		envVarProvider:  envVarProvider,
		log:             log.New("plugins.backend.registration"),
	}
}

// Initialize will initialize a backend plugin client, if the plugin is a backend plugin.
func (b *BackendClientInit) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.Backend {
		backendFactory := b.backendProvider.BackendFactory(ctx, p)
		if backendFactory == nil {
			return nil, errors.New("could not find backend factory for plugin")
		}

		env, err := b.envVarProvider.Get(ctx, p)
		if err != nil {
			return nil, err
		}
		if backendClient, err := backendFactory(p.ID, p.Logger(), env); err != nil {
			return nil, err
		} else {
			p.RegisterClient(backendClient)
		}
	}
	return p, nil
}

// PluginRegistration implements an InitializeFunc for registering a plugin with the plugin registry.
type PluginRegistration struct {
	pluginRegistry registry.Service
	log            log.Logger
}

// NewPluginRegistrationStep returns a new InitializeFunc for registering a plugin with the plugin registry.
func NewPluginRegistrationStep(pluginRegistry registry.Service) InitializeFunc {
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
		r.log.Error("Could not register plugin", "pluginID", p.ID, "err", err)
		return nil, errors.New("could not register plugin")
	}
	if !p.IsCorePlugin() {
		r.log.Info("Plugin registered", "pluginID", p.ID)
	}

	return p, nil
}
