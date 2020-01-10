package backendplugin

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/xerrors"
)

var (
	pluginsMu sync.RWMutex
	plugins   = make(map[string]*BackendPlugin)
	logger    = log.New("plugins.backend")
)

type BackendPluginCallbackFunc func(pluginID string, client *plugin.Client, logger log.Logger) error

type BackendPlugin struct {
	id              string
	executablePath  string
	managed         bool
	clientFactory   func() *plugin.Client
	client          *plugin.Client
	logger          log.Logger
	callbackFn      BackendPluginCallbackFunc
	supportsMetrics bool
	supportsHealth  bool
}

func (p *BackendPlugin) start(ctx context.Context) error {
	p.client = p.clientFactory()
	// rpcClient, err := p.client.Client()
	// if err != nil {
	// 	return err
	// }
	// if p.client.NegotiatedVersion() > 1 {
	// 	_, err = rpcClient.Dispense("diagnostics")
	// 	if err != nil {
	// 		return err
	// 	}
	// }

	if p.callbackFn != nil {
		return p.callbackFn(p.id, p.client, p.logger)
	}

	return nil
}

func (p *BackendPlugin) stop() error {
	if p.client != nil {
		p.client.Kill()
	}
	return nil
}

func (p *BackendPlugin) collectMetrics(ctx context.Context) {
	if !p.supportsMetrics {
		return
	}
}

func (p *BackendPlugin) checkHealth(ctx context.Context) {
	if !p.supportsHealth {
		return
	}
}

// Register registers a backend plugin
func Register(descriptor PluginDescriptor, callbackFn BackendPluginCallbackFunc) error {
	logger.Debug("Registering backend plugin", "pluginId", descriptor.pluginID, "executablePath", descriptor.executablePath)
	pluginsMu.Lock()
	defer pluginsMu.Unlock()

	if _, exists := plugins[descriptor.pluginID]; exists {
		return errors.New("Backend plugin already registered")
	}

	pluginLogger := logger.New("pluginId", descriptor.pluginID)
	plugin := &BackendPlugin{
		id:             descriptor.pluginID,
		executablePath: descriptor.executablePath,
		managed:        descriptor.managed,
		clientFactory: func() *plugin.Client {
			return plugin.NewClient(newClientConfig(descriptor.executablePath, pluginLogger, descriptor.versionedPlugins))
		},
		callbackFn: callbackFn,
		logger:     pluginLogger,
	}

	plugins[descriptor.pluginID] = plugin
	logger.Debug("Backend plugin registered", "pluginId", descriptor.pluginID, "executablePath", descriptor.executablePath)
	return nil
}

// Start starts all managed backend plugins
func Start(ctx context.Context) {
	pluginsMu.RLock()
	defer pluginsMu.RUnlock()
	for _, p := range plugins {
		if !p.managed {
			continue
		}

		if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
			p.logger.Error("Failed to start plugin", "error", err)
		}
	}
}

// StartPlugin starts a non-managed backend plugin
func StartPlugin(ctx context.Context, pluginID string) error {
	pluginsMu.RLock()
	p, registered := plugins[pluginID]
	pluginsMu.RUnlock()
	if !registered {
		return errors.New("Backend plugin not registered")
	}

	if p.managed {
		return errors.New("Backend plugin is managed and cannot be manually started")
	}

	return startPluginAndRestartKilledProcesses(ctx, p)
}

func startPluginAndRestartKilledProcesses(ctx context.Context, p *BackendPlugin) error {
	if err := p.start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p *BackendPlugin) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.logger.Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

// Stop stops all managed backend plugins
func Stop() {
	pluginsMu.RLock()
	defer pluginsMu.RUnlock()
	for _, p := range plugins {
		go func(p *BackendPlugin) {
			p.logger.Debug("Stopping plugin")
			if err := p.stop(); err != nil {
				p.logger.Error("Failed to stop plugin", "error", err)
			}
			p.logger.Debug("Plugin stopped")
		}(p)
	}
}

// CollectMetrics collect metrics from backend plugins
func CollectMetrics(ctx context.Context) {
	for _, p := range plugins {
		p.collectMetrics(ctx)
	}
}

// CheckHealth checks health of backend plugins
func CheckHealth(ctx context.Context) {
	for _, p := range plugins {
		p.checkHealth(ctx)
	}
}

func restartKilledProcess(ctx context.Context, p *BackendPlugin) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !xerrors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
			if !p.client.Exited() {
				continue
			}

			p.logger.Debug("Restarting plugin")
			if err := p.start(ctx); err != nil {
				p.logger.Error("Failed to restart plugin", "error", err)
				continue
			}
			p.logger.Debug("Plugin restarted")
		}
	}
}
