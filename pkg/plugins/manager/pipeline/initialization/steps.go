package initialization

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

type BackendProcessRegistration struct {
	envVarProvider  envvars.Provider
	backendProvider plugins.BackendFactoryProvider
	log             log.Logger
}

func NewBackendProcessRegistrationStep(envVarProvider envvars.Provider,
	backendProvider plugins.BackendFactoryProvider) InitializeFunc {
	return newBackendProcessRegistration(envVarProvider, backendProvider).Initialize
}

func newBackendProcessRegistration(envVarProvider envvars.Provider,
	backendProvider plugins.BackendFactoryProvider) *BackendProcessRegistration {
	return &BackendProcessRegistration{
		backendProvider: backendProvider,
		envVarProvider:  envVarProvider,
		log:             log.New("plugins.backend.registration"),
	}
}

func (b *BackendProcessRegistration) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
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

type PluginRegistration struct {
	pluginRegistry registry.Service
	log            log.Logger
}

func NewPluginRegistrationStep(pluginRegistry registry.Service) InitializeFunc {
	return newPluginRegistration(pluginRegistry).Initialize
}

func newPluginRegistration(pluginRegistry registry.Service) *PluginRegistration {
	return &PluginRegistration{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugins.registration"),
	}
}

func (r *PluginRegistration) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.pluginRegistry.Add(ctx, p); err != nil {
		r.log.Error("Could not register plugin", "pluginID", p.ID, "err", err)
		return nil, errors.New("could not register plugin") // is this okay?
	}
	if !p.IsCorePlugin() {
		r.log.Info("Plugin registered", "pluginID", p.ID)
	}

	return p, nil
}
