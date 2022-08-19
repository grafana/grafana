package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

//Load and start
type Thing struct {
	processManager process.Service
	pluginRegistry registry.Service
	pluginLoader   loader.Service

	log log.Logger
}

func NewThing(processManager process.Service, pluginRegistry registry.Service, pluginLoader loader.Service) *Thing {
	return &Thing{
		processManager: processManager,
		pluginRegistry: pluginRegistry,
		pluginLoader:   pluginLoader,
		log:            log.New("plugin.thing"),
	}
}

func (m *Thing) LoadAndStart(ctx context.Context, class plugins.Class, pluginPaths []string) error {
	//registeredPlugins := make(map[string]struct{})
	//for _, p := range m.pluginRegistry.Plugins(ctx) {
	//	registeredPlugins[p.ID] = struct{}{}
	//}

	loadedPlugins, err := m.pluginLoader.Load(ctx, class, pluginPaths)
	if err != nil {
		m.log.Error("Could not load plugins", "paths", pluginPaths, "err", err)
		return err
	}

	for _, p := range loadedPlugins {
		if err = m.pluginRegistry.Add(ctx, p); err != nil {
			m.log.Error("Could not add plugin to the registry", "pluginId", p.ID, "err", err)
		}
		if err = m.processManager.Start(ctx, p.ID); err != nil {
			m.log.Error("Could not start plugin", "pluginId", p.ID, "err", err)
		}
	}

	return nil
}

func (m *Thing) unregisterAndStop(ctx context.Context, p *plugins.Plugin) error {
	m.log.Debug("Stopping plugin process", "pluginId", p.ID)

	if err := m.processManager.Stop(ctx, p.ID); err != nil {
		return err
	}

	if err := m.pluginRegistry.Remove(ctx, p.ID); err != nil {
		return err
	}
	m.log.Debug("Plugin unregistered", "pluginId", p.ID)
	return nil
}
