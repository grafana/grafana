package termination

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// BackendProcessTerminator implements a TerminateFunc for stopping a backend plugin process.
//
// It uses the process.Manager to stop the backend plugin process.
type BackendProcessTerminator struct {
	processManager process.Manager
	log            log.Logger
}

// BackendProcessTerminatorStep returns a new TerminateFunc for stopping a backend plugin process.
func BackendProcessTerminatorStep(processManager process.Manager) TerminateFunc {
	return newBackendProcessTerminator(processManager).Terminate
}

func newBackendProcessTerminator(processManager process.Manager) *BackendProcessTerminator {
	return &BackendProcessTerminator{
		processManager: processManager,
		log:            log.New("plugins.backend.termination"),
	}
}

// Terminate stops a backend plugin process.
func (t *BackendProcessTerminator) Terminate(ctx context.Context, p *plugins.Plugin) error {
	return t.processManager.Stop(ctx, p)
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
