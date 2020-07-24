package backendplugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"golang.org/x/xerrors"
)

var (
	// ErrPluginNotRegistered error returned when plugin not registered.
	ErrPluginNotRegistered = errors.New("Plugin not registered")
	// ErrHealthCheckFailed error returned when health check failed.
	ErrHealthCheckFailed = errors.New("Health check failed")
	// ErrPluginUnavailable error returned when plugin is unavailable.
	ErrPluginUnavailable = errors.New("Plugin unavailable")
	// ErrMethodNotImplemented error returned when plugin method not implemented.
	ErrMethodNotImplemented = errors.New("method not implemented")
)

func init() {
	registry.RegisterService(&manager{})
}

// Manager manages backend plugins.
type Manager interface {
	// Register registers a backend plugin
	Register(pluginID string, factory PluginFactoryFunc) error
	// StartPlugin starts a non-managed backend plugin
	StartPlugin(ctx context.Context, pluginID string) error
	// CollectMetrics collects metrics from a registered backend plugin.
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
	// CheckHealth checks the health of a registered backend plugin.
	CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error)
	// CallResource calls a plugin resource.
	CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string)
}

type manager struct {
	Cfg            *setting.Cfg     `inject:""`
	License        models.Licensing `inject:""`
	pluginsMu      sync.RWMutex
	plugins        map[string]Plugin
	logger         log.Logger
	pluginSettings map[string]pluginSettings
}

func (m *manager) Init() error {
	m.plugins = make(map[string]Plugin)
	m.logger = log.New("plugins.backend")
	m.pluginSettings = extractPluginSettings(m.Cfg)

	return nil
}

func (m *manager) Run(ctx context.Context) error {
	m.start(ctx)
	<-ctx.Done()
	m.stop(ctx)
	return ctx.Err()
}

// Register registers a backend plugin
func (m *manager) Register(pluginID string, factory PluginFactoryFunc) error {
	m.logger.Debug("Registering backend plugin", "pluginId", pluginID)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	if _, exists := m.plugins[pluginID]; exists {
		return errors.New("Backend plugin already registered")
	}

	pluginSettings := pluginSettings{}
	if ps, exists := m.pluginSettings[pluginID]; exists {
		pluginSettings = ps
	}

	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", m.Cfg.BuildVersion),
		fmt.Sprintf("GF_EDITION=%s", m.License.Edition()),
	}

	if m.License.HasLicense() {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_PATH=%s", m.Cfg.EnterpriseLicensePath),
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_TEXT=%s", m.License.TokenRaw()),
		)
	}

	env := pluginSettings.ToEnv("GF_PLUGIN", hostEnv)

	pluginLogger := m.logger.New("pluginId", pluginID)
	plugin, err := factory(pluginID, pluginLogger, env)
	if err != nil {
		return err
	}

	m.plugins[pluginID] = plugin
	m.logger.Debug("Backend plugin registered", "pluginId", pluginID)
	return nil
}

// start starts all managed backend plugins
func (m *manager) start(ctx context.Context) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	for _, p := range m.plugins {
		if !p.IsManaged() {
			continue
		}

		if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
			p.Logger().Error("Failed to start plugin", "error", err)
			continue
		}
	}
}

// StartPlugin starts a non-managed backend plugin
func (m *manager) StartPlugin(ctx context.Context, pluginID string) error {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginID]
	m.pluginsMu.RUnlock()
	if !registered {
		return ErrPluginNotRegistered
	}

	if p.IsManaged() {
		return errors.New("Backend plugin is managed and cannot be manually started")
	}

	return startPluginAndRestartKilledProcesses(ctx, p)
}

// stop stops all managed backend plugins
func (m *manager) stop(ctx context.Context) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	var wg sync.WaitGroup
	for _, p := range m.plugins {
		wg.Add(1)
		go func(p Plugin, ctx context.Context) {
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

// CollectMetrics collects metrics from a registered backend plugin.
func (m *manager) CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error) {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginID]
	m.pluginsMu.RUnlock()

	if !registered {
		return nil, ErrPluginNotRegistered
	}

	var resp *backend.CollectMetricsResult
	err := instrumentCollectMetrics(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CollectMetrics(ctx)
		return
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// CheckHealth checks the health of a registered backend plugin.
func (m *manager) CheckHealth(ctx context.Context, pluginContext backend.PluginContext) (*backend.CheckHealthResult, error) {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginContext.PluginID]
	m.pluginsMu.RUnlock()

	if !registered {
		return nil, ErrPluginNotRegistered
	}

	var resp *backend.CheckHealthResult
	err := instrumentCheckHealthRequest(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: pluginContext})
		return
	})

	if err != nil {
		if errors.Is(err, ErrMethodNotImplemented) {
			return nil, err
		}

		return nil, errutil.Wrap("Failed to check plugin health", ErrHealthCheckFailed)
	}

	return resp, nil
}

type keepCookiesJSONModel struct {
	KeepCookies []string `json:"keepCookies"`
}

func (m *manager) callResourceInternal(w http.ResponseWriter, req *http.Request, pCtx backend.PluginContext) error {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pCtx.PluginID]
	m.pluginsMu.RUnlock()

	if !registered {
		return ErrPluginNotRegistered
	}

	keepCookieModel := keepCookiesJSONModel{}
	if dis := pCtx.DataSourceInstanceSettings; dis != nil {
		err := json.Unmarshal(dis.JSONData, &keepCookieModel)
		if err != nil {
			p.Logger().Error("Failed to to unpack JSONData in datasource instance settings", "error", err)
		}
	}

	proxyutil.ClearCookieHeader(req, keepCookieModel.KeepCookies)
	proxyutil.PrepareProxyRequest(req)

	body, err := ioutil.ReadAll(req.Body)
	if err != nil {
		return errors.New("Failed to read request body")
	}

	crReq := &backend.CallResourceRequest{
		PluginContext: pCtx,
		Path:          req.URL.Path,
		Method:        req.Method,
		URL:           req.URL.String(),
		Headers:       req.Header,
		Body:          body,
	}

	return instrumentCallResourceRequest(p.PluginID(), func() error {
		childCtx, cancel := context.WithCancel(req.Context())
		defer cancel()
		stream := newCallResourceResponseStream(childCtx)
		var wg sync.WaitGroup
		wg.Add(1)
		var flushStreamErr error
		go func() {
			flushStreamErr = flushStream(p, stream, w)
			wg.Done()
		}()

		innerErr := p.CallResource(req.Context(), crReq, stream)
		stream.Close()
		if innerErr != nil {
			return innerErr
		}
		wg.Wait()
		return flushStreamErr
	})
}

// CallResource calls a plugin resource.
func (m *manager) CallResource(pCtx backend.PluginContext, reqCtx *models.ReqContext, path string) {
	clonedReq := reqCtx.Req.Clone(reqCtx.Req.Context())
	rawURL := path
	if clonedReq.URL.RawQuery != "" {
		rawURL += "?" + clonedReq.URL.RawQuery
	}
	urlPath, err := url.Parse(rawURL)
	if err != nil {
		handleCallResourceError(err, reqCtx)
		return
	}
	clonedReq.URL = urlPath
	err = m.callResourceInternal(reqCtx.Resp, clonedReq, pCtx)
	if err != nil {
		handleCallResourceError(err, reqCtx)
	}
}

func handleCallResourceError(err error, reqCtx *models.ReqContext) {
	if errors.Is(err, ErrPluginUnavailable) {
		reqCtx.JsonApiErr(503, "Plugin unavailable", err)
		return
	}

	if errors.Is(err, ErrMethodNotImplemented) {
		reqCtx.JsonApiErr(404, "Not found", err)
		return
	}

	reqCtx.JsonApiErr(500, "Failed to call resource", err)
}

func flushStream(plugin Plugin, stream CallResourceClientResponseStream, w http.ResponseWriter) error {
	processedStreams := 0

	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			if processedStreams == 0 {
				return errors.New("Received empty resource response")
			}
			return nil
		}
		if err != nil {
			if processedStreams == 0 {
				return errutil.Wrap("Failed to receive response from resource call", err)
			}

			plugin.Logger().Error("Failed to receive response from resource call", "error", err)
			return stream.Close()
		}

		// Expected that headers and status are only part of first stream
		if processedStreams == 0 && resp.Headers != nil {
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
					w.Header().Add(k, v)
				}
			}

			w.WriteHeader(resp.Status)
		}

		if _, err := w.Write(resp.Body); err != nil {
			plugin.Logger().Error("Failed to write resource response", "error", err)
		}

		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		processedStreams++
	}
}

func startPluginAndRestartKilledProcesses(ctx context.Context, p Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p Plugin) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func restartKilledProcess(ctx context.Context, p Plugin) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !xerrors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
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
