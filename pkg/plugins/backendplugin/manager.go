package backendplugin

import (
	"context"
	"errors"
	"sync"
	"time"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	backend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/xerrors"
)

var (
	pluginsMu sync.RWMutex
	plugins   = make(map[string]*BackendPlugin)
	logger    = log.New("plugins.backend")
)

type BackendPlugin struct {
	id              string
	executablePath  string
	managed         bool
	clientFactory   func() *plugin.Client
	client          *plugin.Client
	logger          log.Logger
	startFns        PluginStartFuncs
	supportsMetrics bool
	supportsHealth  bool
}

func (p *BackendPlugin) start(ctx context.Context) error {
	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	var legacyClient *LegacyClient
	var client *Client

	if p.client.NegotiatedVersion() > 1 {
		rawBackend, err := rpcClient.Dispense("backend")
		if err != nil {
			return err
		}

		rawTransform, err := rpcClient.Dispense("transform")
		if err != nil {
			return err
		}

		client = &Client{}
		if rawBackend != nil {
			if plugin, ok := rawBackend.(backend.BackendPlugin); ok {
				client.BackendPlugin = plugin
			}
		}

		if rawTransform != nil {
			if plugin, ok := rawTransform.(backend.TransformPlugin); ok {
				client.TransformPlugin = plugin
			}
		}
	} else {
		raw, err := rpcClient.Dispense(p.id)
		if err != nil {
			return err
		}

		legacyClient = &LegacyClient{}
		if plugin, ok := raw.(datasourceV1.DatasourcePlugin); ok {
			legacyClient.DatasourcePlugin = plugin
		}

		if plugin, ok := raw.(rendererV1.RendererPlugin); ok {
			legacyClient.RendererPlugin = plugin
		}
	}

	if legacyClient == nil && client == nil {
		return errors.New("no compatible plugin implementation found")
	}

	if legacyClient != nil && p.startFns.OnLegacyStart != nil {
		if err := p.startFns.OnLegacyStart(p.id, legacyClient, p.logger); err != nil {
			return err
		}
	}

	if client != nil && p.startFns.OnStart != nil {
		if err := p.startFns.OnStart(p.id, client, p.logger); err != nil {
			return err
		}
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
func Register(descriptor PluginDescriptor) error {
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
		startFns: descriptor.startFns,
		logger:   pluginLogger,
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
