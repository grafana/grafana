package client

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
)

var (
	errConflict = errors.New("a plugin with the same ID is already registered")
	errNotFound = errors.New("no plugin with that ID is registered")
)

type Registry interface {
	// Get retrieves a plugin client from the registry.
	Get(ctx context.Context, pluginID string) (plugins.PluginClient, bool)
	// Register adds the provided backend plugin to the registry.
	Register(ctx context.Context, p *plugins.Plugin) (plugins.PluginClient, error)
	// Deregister removes the provided backend plugin from the registry.
	Deregister(ctx context.Context, p *plugins.Plugin) error
	// Shutdown will stop all plugins in the registry
	Shutdown(ctx context.Context) // Might not need this
}

type BackendClientRegistry struct {
	envVarProvider  envvars.Provider
	backendProvider plugins.BackendFactoryProvider
	processManager  process.Manager
	registry        map[string]backendplugin.Plugin

	mutex sync.RWMutex
}

func ProvideBackendClientRegistry(backendProvider plugins.BackendFactoryProvider, envVarProvider envvars.Provider,
	processManager process.Manager) *BackendClientRegistry {
	return newBackendClientRegistry(backendProvider, envVarProvider, processManager)
}

func newBackendClientRegistry(backendProvider plugins.BackendFactoryProvider, envVarProvider envvars.Provider,
	processManager process.Manager) *BackendClientRegistry {
	return &BackendClientRegistry{
		backendProvider: backendProvider,
		envVarProvider:  envVarProvider,
		processManager:  processManager,
		registry:        make(map[string]backendplugin.Plugin),
	}
}

func (r *BackendClientRegistry) Get(ctx context.Context, pluginID string) (plugins.PluginClient, bool) {
	r.mutex.RLock()
	pc, exists := r.registry[pluginID]
	r.mutex.RUnlock()
	if exists {
		r.mutex.Lock()
		defer r.mutex.Unlock()
		if !pc.Exited() {
			return pc, true
		}
		if err := pc.Start(ctx); err != nil {
			return nil, false
		}
		return pc, true
	}

	return nil, false
}

func (r *BackendClientRegistry) Register(ctx context.Context, p *plugins.Plugin) (plugins.PluginClient, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.registry[p.ID]
	if exists {
		return nil, errConflict
	}

	backendFactory := r.backendProvider.BackendFactory(ctx, p)
	if backendFactory == nil {
		return nil, errors.New("could not find backend factory for plugin")
	}

	// this will ensure that the env variables are calculated every time a plugin is started
	envFunc := func() []string { return r.envVarProvider.Get(ctx, p) }

	backendClient, err := backendFactory(p.ID, p.Logger(), envFunc)
	if err != nil {
		return nil, err
	}

	//if err = backendClient.Start(ctx); err != nil {
	//	return nil, err
	//}

	// OR

	if err = r.processManager.Start(ctx, backendClient); err != nil {
		return nil, err
	}

	r.registry[p.ID] = backendClient

	return backendClient, nil
}

func (r *BackendClientRegistry) Deregister(ctx context.Context, p *plugins.Plugin) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	c, exists := r.registry[p.ID]
	if !exists {
		return errNotFound
	}

	if err := r.processManager.Stop(ctx, c); err != nil {
		return err
	}

	delete(r.registry, p.ID)

	return nil
}

func (r *BackendClientRegistry) Shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	for _, p := range r.registry {
		wg.Add(1)
		go func(ctx context.Context, p backendplugin.Plugin) {
			defer wg.Done()
			p.Logger().Debug("Stopping plugin")
			if err := r.processManager.Stop(ctx, p); err != nil {
				p.Logger().Error("Failed to stop plugin", "error", err)
			}
			p.Logger().Info("Plugin stopped")
		}(ctx, p)
	}

	wg.Wait()
}
