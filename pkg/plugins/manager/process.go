package manager

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

var _ plugins.ProcessManager = (*ProcessManager)(nil)

type ProcessManager struct {
	pluginRegistry registry.Service

	mu  sync.Mutex
	log log.Logger
}

func ProvideProcessManager(pluginRegistry registry.Service) *ProcessManager {
	return &ProcessManager{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugin.process.manager"),
	}
}

func (pm *ProcessManager) Start(ctx context.Context, p *plugins.Plugin) error {
	if !p.IsManaged() || !p.Backend || p.SignatureError != nil {
		return nil
	}

	if p.IsCorePlugin() {
		return nil
	}

	pm.log.Debug("Starting plugin process", "pluginId", p.ID)
	pm.mu.Lock()
	if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
		return err
	}

	p.Logger().Debug("Successfully started backend plugin process")
	pm.mu.Unlock()
	return nil
}

func (pm *ProcessManager) Stop(ctx context.Context, p *plugins.Plugin) error {
	pm.log.Debug("Stopping plugin process", "pluginId", p.ID)
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if err := p.Decommission(); err != nil {
		return err
	}

	if err := p.Stop(ctx); err != nil {
		return err
	}

	return nil
}

// Shutdown stops all backend plugin processes
func (pm *ProcessManager) Shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	for _, p := range pm.pluginRegistry.Plugins(ctx) { // skip decommissioned?
		wg.Add(1)
		go func(p backendplugin.Plugin, ctx context.Context) {
			defer wg.Done()
			p.Logger().Debug("Stopping plugin")
			if err := p.Stop(ctx); err != nil {
				p.Logger().Error("Failed to stop plugin", "error", err)
			}
			p.Logger().Debug("Plugin stopped")
		}(p, ctx)
	}
	wg.Wait()
}

func startPluginAndRestartKilledProcesses(ctx context.Context, p *plugins.Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p *plugins.Plugin) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func restartKilledProcess(ctx context.Context, p *plugins.Plugin) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !errors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
			if p.IsDecommissioned() {
				p.Logger().Debug("Plugin decommissioned")
				return nil
			}

			if !p.Exited() {
				continue
			}

			p.Logger().Debug("Restarting plugin")
			if err := p.Start(ctx); err != nil {
				p.Logger().Error("Failed to restart plugin", "error", err)
				continue
			}
			p.Logger().Debug("Plugin restarted")
		}
	}
}
