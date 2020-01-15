package backendplugin

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/collector"
	"github.com/grafana/grafana/pkg/registry"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/xerrors"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "BackendPluginManager",
		Instance:     &manager{},
		InitPriority: registry.Low,
	})
}

// Manager manages backend plugins.
type Manager interface {
	// Register registers a backend plugin
	Register(descriptor PluginDescriptor) error
	// StartPlugin starts a non-managed backend plugin
	StartPlugin(ctx context.Context, pluginID string) error
}

type manager struct {
	RouteRegister   routing.RouteRegister `inject:""`
	pluginsMu       sync.RWMutex
	plugins         map[string]*BackendPlugin
	pluginCollector collector.PluginCollector
	logger          log.Logger
}

func (m *manager) Init() error {
	m.plugins = make(map[string]*BackendPlugin)
	m.logger = log.New("plugins.backend")
	m.pluginCollector = collector.NewPluginCollector()
	prometheus.MustRegister(m.pluginCollector)

	m.RouteRegister.Get("/api/plugins/:pluginId/health", m.checkHealth)

	return nil
}

func (m *manager) Run(ctx context.Context) error {
	m.start(ctx)
	<-ctx.Done()
	m.stop()
	return ctx.Err()
}

// Register registers a backend plugin
func (m *manager) Register(descriptor PluginDescriptor) error {
	m.logger.Debug("Registering backend plugin", "pluginId", descriptor.pluginID, "executablePath", descriptor.executablePath)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	if _, exists := m.plugins[descriptor.pluginID]; exists {
		return errors.New("Backend plugin already registered")
	}

	pluginLogger := m.logger.New("pluginId", descriptor.pluginID)
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

	m.plugins[descriptor.pluginID] = plugin
	m.logger.Debug("Backend plugin registered", "pluginId", descriptor.pluginID, "executablePath", descriptor.executablePath)
	return nil
}

// start starts all managed backend plugins
func (m *manager) start(ctx context.Context) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	for _, p := range m.plugins {
		if !p.managed {
			continue
		}

		if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
			p.logger.Error("Failed to start plugin", "error", err)
			continue
		}

		if p.supportsDiagnostics() {
			p.logger.Debug("Registering metrics collector")
			m.pluginCollector.Register(p.id, p)
		}
	}
}

// StartPlugin starts a non-managed backend plugin
func (m *manager) StartPlugin(ctx context.Context, pluginID string) error {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginID]
	m.pluginsMu.RUnlock()
	if !registered {
		return errors.New("Backend plugin not registered")
	}

	if p.managed {
		return errors.New("Backend plugin is managed and cannot be manually started")
	}

	return startPluginAndRestartKilledProcesses(ctx, p)
}

// stop stops all managed backend plugins
func (m *manager) stop() {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	for _, p := range m.plugins {
		go func(p *BackendPlugin) {
			p.logger.Debug("Stopping plugin")
			if err := p.stop(); err != nil {
				p.logger.Error("Failed to stop plugin", "error", err)
			}
			p.logger.Debug("Plugin stopped")
		}(p)
	}
}

// checkHealth http handler for checking plugin health.
func (m *manager) checkHealth(c *models.ReqContext) {
	pluginID := c.Params("pluginId")
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginID]
	m.pluginsMu.RUnlock()

	if !registered || !p.supportsDiagnostics() {
		c.JsonApiErr(404, "Plugin not found", nil)
		return
	}

	res, err := p.checkHealth(c.Req.Context())
	if err != nil {
		p.logger.Error("Failed to check plugin health", "error", err)
		c.JSON(503, map[string]interface{}{
			"status": pluginv2.CheckHealth_Response_ERROR.String(),
		})
		return
	}

	payload := map[string]interface{}{
		"status": res.Status.String(),
		"info":   res.Info,
	}

	if res.Status != pluginv2.CheckHealth_Response_OK {
		c.JSON(503, payload)
		return
	}

	c.JSON(200, payload)
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
