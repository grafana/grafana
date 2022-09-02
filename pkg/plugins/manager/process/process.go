package process

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/signature"
)

var _ Service = (*Manager)(nil)

type Manager struct {
	pluginRegistry     registry.Service
	signatureValidator signature.Validator

	mu  sync.Mutex
	log log.Logger
}

func ProvideService(pluginRegistry registry.Service, authorizer signature.PluginLoaderAuthorizer) *Manager {
	return NewManager(pluginRegistry, authorizer)
}

func NewManager(pluginRegistry registry.Service, authorizer signature.PluginLoaderAuthorizer) *Manager {
	return &Manager{
		pluginRegistry:     pluginRegistry,
		signatureValidator: signature.NewValidator(authorizer),
		log:                log.New("plugin.process.manager"),
	}
}

func (m *Manager) Run(ctx context.Context) error {
	<-ctx.Done()
	m.shutdown(ctx)
	return ctx.Err()
}

func (m *Manager) Start(ctx context.Context, pluginID string) error {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	if !p.IsManaged() || !p.Backend || p.SignatureError != nil {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if err := m.startPluginAndRestartKilledProcesses(ctx, p); err != nil {
		return err
	}

	p.Logger().Debug("Successfully started backend plugin process")
	return nil
}

func (m *Manager) Stop(ctx context.Context, pluginID string) error {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}
	m.log.Debug("Stopping plugin process", "pluginID", p.ID)
	m.mu.Lock()
	defer m.mu.Unlock()

	if err := p.Decommission(); err != nil {
		return err
	}

	if err := p.Stop(ctx); err != nil {
		return err
	}

	return nil
}

// shutdown stops all backend plugin processes
func (m *Manager) shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	for _, p := range m.pluginRegistry.Plugins(ctx) {
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

func (m *Manager) startPluginAndRestartKilledProcesses(ctx context.Context, p *plugins.Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	if p.IsCorePlugin() {
		return nil
	}

	go func(ctx context.Context, p *plugins.Plugin) {
		if err := m.restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func (m *Manager) restartKilledProcess(ctx context.Context, p *plugins.Plugin) error {
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

			if err := p.CalculateSignature(); err != nil {
				p.Logger().Error("Failed to re-calculate plugin signature", "error", err)
				if err = p.Stop(ctx); err != nil {
					p.Logger().Error("Failed to stop plugin", "error", err)
					return m.Stop(ctx, p.ID)
				}
			}

			signingError := m.signatureValidator.Validate(signature.Args{
				PluginID:        p.ID,
				SignatureStatus: p.Signature,
				IsExternal:      p.IsExternalPlugin(),
			})
			if signingError != nil {
				p.Logger().Warn("Skipping restarting plugin due to problem with signature",
					"pluginID", p.ID, "status", signingError.SignatureStatus)
				p.SignatureError = signingError
				m.mu.Lock()
				//m.errs[p.ID] = signingError
				p.SignatureError = signingError
				m.mu.Unlock()
				// skip plugin so it will not be restarted
				return nil
			}

			// clear plugin error if a pre-existing error has since been resolved
			m.mu.Lock()
			//delete(m.errs, p.ID)
			p.SignatureError = signingError
			m.mu.Unlock()

			p.Logger().Debug("Restarting plugin")
			if err := p.Start(ctx); err != nil {
				p.Logger().Error("Failed to restart plugin", "error", err)
				continue
			}
			p.Logger().Debug("Plugin restarted")
		}
	}
}
