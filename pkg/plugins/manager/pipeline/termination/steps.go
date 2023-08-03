package termination

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// TerminablePluginResolver implements a ResolveFunc for resolving a plugin that can be terminated.
type TerminablePluginResolver struct {
	pluginRegistry registry.Service
	log            log.Logger
}

// TerminablePluginResolverStep returns a new ResolveFunc for resolving a plugin that can be terminated.
func TerminablePluginResolverStep(pluginRegistry registry.Service) ResolveFunc {
	return newTerminablePluginResolver(pluginRegistry).Resolve
}

func newTerminablePluginResolver(pluginRegistry registry.Service) *TerminablePluginResolver {
	return &TerminablePluginResolver{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugins.resolver"),
	}
}

// Resolve returns a plugin that can be terminated.
func (r *TerminablePluginResolver) Resolve(ctx context.Context, pluginID string) (*plugins.Plugin, error) {
	p, exists := r.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, plugins.ErrPluginNotInstalled
	}

	// core plugins and bundled plugins cannot be terminated
	if p.IsCorePlugin() || p.IsBundledPlugin() {
		return nil, plugins.ErrUninstallCorePlugin
	}

	return p, nil
}

// BackendProcessTerminator implements a TerminateFunc for stopping a backend plugin process.
//
// It uses the process.Service to stop the backend plugin process.
type BackendProcessTerminator struct {
	processManager process.Service
	log            log.Logger
}

// BackendProcessTerminatorStep returns a new TerminateFunc for stopping a backend plugin process.
func BackendProcessTerminatorStep(processManager process.Service) TerminateFunc {
	return newBackendProcessTerminator(processManager).Terminate
}

func newBackendProcessTerminator(processManager process.Service) *BackendProcessTerminator {
	return &BackendProcessTerminator{
		processManager: processManager,
		log:            log.New("plugins.backend.termination"),
	}
}

// Terminate stops a backend plugin process.
func (t *BackendProcessTerminator) Terminate(ctx context.Context, p *plugins.Plugin) error {
	t.log.Debug("Stopping plugin process", "pluginId", p.ID)

	return t.processManager.Stop(ctx, p.ID)
}

// Deregister implements a TerminateFunc for removing a plugin from the plugin registry.
type Deregister struct {
	pluginRegistry registry.Service
	log            log.Logger
}

// DeregisterStep returns a new TerminateFunc for removing a plugin from the plugin registry.
func DeregisterStep(pluginRegistry registry.Service) TerminateFunc {
	return newDeregister(pluginRegistry).Deregister
}

func newDeregister(pluginRegistry registry.Service) *Deregister {
	return &Deregister{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugins.deregister"),
	}
}

// Deregister removes a plugin from the plugin registry.
func (d *Deregister) Deregister(ctx context.Context, p *plugins.Plugin) error {
	if err := d.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}
	d.log.Debug("Plugin unregistered", "pluginId", p.ID)
	return nil
}

// FSRemoval implements a TerminateFunc for removing plugin files from the filesystem.
func FSRemoval(_ context.Context, p *plugins.Plugin) error {
	if remover, ok := p.FS.(plugins.FSRemover); ok {
		if err := remover.Remove(); err != nil {
			return err
		}
	}
	return nil
}
