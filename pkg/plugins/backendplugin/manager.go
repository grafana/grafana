package backendplugin

import (
	"context"
	"errors"
	"io"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util/proxyutil"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/collector"
	"github.com/grafana/grafana/pkg/registry"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/xerrors"
)

var (
	// ErrPluginNotRegistered error returned when plugin not registered.
	ErrPluginNotRegistered = errors.New("Plugin not registered")
	// ErrDiagnosticsNotSupported error returned when plugin doesn't support diagnostics.
	ErrDiagnosticsNotSupported = errors.New("Plugin diagnostics not supported")
	// ErrHealthCheckFailed error returned when health check failed.
	ErrHealthCheckFailed = errors.New("Health check failed")
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
	// CheckHealth checks the health of a registered backend plugin.
	CheckHealth(ctx context.Context, pluginID string) (*CheckHealthResult, error)
	// CallResource calls a plugin resource.
	CallResource(pluginConfig PluginConfig, ctx *models.ReqContext, path string)
}

type manager struct {
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

// CheckHealth checks the health of a registered backend plugin.
func (m *manager) CheckHealth(ctx context.Context, pluginID string) (*CheckHealthResult, error) {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginID]
	m.pluginsMu.RUnlock()

	if !registered {
		return nil, ErrPluginNotRegistered
	}

	if !p.supportsDiagnostics() {
		return nil, ErrDiagnosticsNotSupported
	}

	res, err := p.checkHealth(ctx)
	if err != nil {
		p.logger.Error("Failed to check plugin health", "error", err)
		return nil, ErrHealthCheckFailed
	}

	return checkHealthResultFromProto(res), nil
}

// CallResource calls a plugin resource.
func (m *manager) CallResource(config PluginConfig, c *models.ReqContext, path string) {
	m.pluginsMu.RLock()
	p, registered := m.plugins[config.PluginID]
	m.pluginsMu.RUnlock()

	if !registered {
		c.JsonApiErr(404, "Plugin not registered", nil)
		return
	}

	clonedReq := c.Req.Clone(c.Req.Context())
	keepCookieNames := []string{}
	if config.JSONData != nil {
		if keepCookies := config.JSONData.Get("keepCookies"); keepCookies != nil {
			keepCookieNames = keepCookies.MustStringArray()
		}
	}

	proxyutil.ClearCookieHeader(clonedReq, keepCookieNames)
	proxyutil.PrepareProxyRequest(clonedReq)

	body, err := c.Req.Body().Bytes()
	if err != nil {
		c.JsonApiErr(500, "Failed to read request body", err)
		return
	}

	req := CallResourceRequest{
		Config:  config,
		Path:    path,
		Method:  clonedReq.Method,
		URL:     clonedReq.URL.String(),
		Headers: clonedReq.Header,
		Body:    body,
	}

	stream, err := p.callResource(clonedReq.Context(), req)
	if err != nil {
		c.JsonApiErr(500, "Failed to call resource", err)
		return
	}

	processedStreams := 0

	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			if processedStreams == 0 {
				c.JsonApiErr(500, "Received empty resource response ", nil)
			}
			return
		}
		if err != nil {
			if processedStreams == 0 {
				c.JsonApiErr(500, "Failed to receive response from resource call", err)
			} else {
				p.logger.Error("Failed to receive response from resource call", "error", err)
			}
			return
		}

		// Expected that headers and status are only part of first stream
		if processedStreams == 0 {
			// Make sure a content type always is returned in response
			if _, exists := resp.Headers["Content-Type"]; !exists {
				resp.Headers["Content-Type"] = []string{"application/json"}
			}

			for k, values := range resp.Headers {
				// Due to security reasons we don't want to forward
				// cookies from a backend plugin to clients/browsers.
				if k == "Set-Cookie" {
					continue
				}

				for _, v := range values {
					c.Resp.Header().Add(k, v)
				}
			}

			c.WriteHeader(resp.Status)
		}

		if _, err := c.Write(resp.Body); err != nil {
			p.logger.Error("Failed to write resource response", "error", err)
		}

		c.Resp.Flush()
		processedStreams++
	}
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
