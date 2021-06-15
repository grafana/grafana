package manager

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

var _ plugins.PluginManagerV2 = (*PluginManagerV2)(nil)

type PluginManagerV2 struct {
	Cfg                    *setting.Cfg                  `inject:""`
	License                models.Licensing              `inject:""`
	PluginFinder           plugins.PluginFinderV2        `inject:""`
	PluginLoader           plugins.PluginLoaderV2        `inject:""`
	PluginInitializer      plugins.PluginInitializerV2   `inject:""`
	PluginRequestValidator models.PluginRequestValidator `inject:""`
	pluginInstaller        plugins.PluginInstaller

	log       log.Logger
	plugins   map[string]*plugins.PluginV2
	pluginsMu sync.RWMutex
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "PluginManagerV2",
		Instance:     &PluginManagerV2{},
		InitPriority: registry.MediumHigh,
	})
}

func (m *PluginManagerV2) Init() error {
	m.plugins = map[string]*plugins.PluginV2{}
	m.log = log.New("plugin.managerv2")
	m.pluginInstaller = installer.New(false, m.Cfg.BuildVersion, NewInstallerLogger("plugin.installer", true))

	// install Core plugins
	//err := m.installPlugins(filepath.Join(m.Cfg.StaticRootPath, "app/plugins"), false)
	//if err != nil {
	//	return err
	//}

	// install Bundled plugins
	err := m.installPlugins(m.Cfg.BundledPluginsPath, false)
	if err != nil {
		return err
	}

	// install External plugins
	externalPluginsDir := m.Cfg.PluginsPath
	exists, err := fs.Exists(externalPluginsDir)
	if err != nil {
		return err
	}

	if !exists {
		if err = os.MkdirAll(m.Cfg.PluginsPath, os.ModePerm); err != nil {
			m.log.Error("Failed to create plugins directory", "dir", externalPluginsDir, "error", err)
		}
	}
	err = m.installPlugins(m.Cfg.PluginsPath, true)
	if err != nil {
		return err
	}

	return nil
}

func (m *PluginManagerV2) Run(ctx context.Context) error {
	<-ctx.Done()
	m.stop(ctx)
	return ctx.Err()
}

func (m *PluginManagerV2) IsDisabled() bool {
	_, exists := m.Cfg.FeatureToggles["pluginManagerV2"]
	return !exists
}

func (m *PluginManagerV2) RegisterCorePlugin(ctx context.Context, pluginJSONPath string, factory backendplugin.PluginFactoryFunc) error {
	fullPath := filepath.Join(m.Cfg.StaticRootPath, "app/plugins", pluginJSONPath)

	plugin, err := m.PluginLoader.Load(fullPath, false)
	if err != nil {
		return err
	}

	plugin.Client, err = factory(plugin.ID, m.log.New("pluginID", plugin.ID), []string{})
	if err != nil {
		return err
	}

	err = m.PluginInitializer.Initialize(plugin)
	if err != nil {
		return err
	}

	if err := m.Register(plugin); err != nil {
		return err
	}

	return nil
}

func (m *PluginManagerV2) installPlugins(path string, requireSigning bool) error {
	exists, err := fs.Exists(path)
	if err != nil {
		return err
	}

	if !exists {
		return fmt.Errorf("aborting install as plugins directory %s does not exist", path)
	}

	pluginJSONPaths, err := m.PluginFinder.Find(path)
	if err != nil {
		return err
	}

	loadedPlugins, err := m.PluginLoader.LoadAll(pluginJSONPaths, requireSigning)
	if err != nil {
		return err
	}
	loadedPlugins = m.filterOutDuplicates(loadedPlugins)

	for _, p := range loadedPlugins {
		err = m.PluginInitializer.Initialize(p)
		if err != nil {
			return err
		}
		if err := m.registerAndStart(context.Background(), p); err != nil {
			return err
		}
	}

	return nil
}

// filterOutDuplicates will strip duplicate plugins or plugins that are already installed
func (m *PluginManagerV2) filterOutDuplicates(loadedPlugins []*plugins.PluginV2) []*plugins.PluginV2 {
	var result []*plugins.PluginV2

	pluginsByID := make(map[string]struct{})
	for _, scannedPlugin := range loadedPlugins {
		//TODO make duplicate checking more intelligent
		if _, dupe := pluginsByID[scannedPlugin.ID]; dupe {
			m.log.Warn("Skipping plugin as it's a duplicate", "id", scannedPlugin.ID)
			continue
		}
		pluginsByID[scannedPlugin.ID] = struct{}{}

		if existing := m.GetPlugin(scannedPlugin.ID); existing != nil {
			m.log.Debug("Skipping plugin as it's already installed", "plugin", existing.ID, "version", existing.Info.Version)
			continue
		}
		result = append(result, scannedPlugin)
	}

	return result
}

func (m *PluginManagerV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plugin := m.GetPlugin(req.PluginContext.PluginID)
	if plugin == nil {
		return &backend.QueryDataResponse{}, nil
	}

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(req.PluginContext.PluginID, func() (innerErr error) {
		resp, innerErr = plugin.QueryData(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, errutil.Wrap("failed to query data", err)
	}

	return resp, err
}

func (m *PluginManagerV2) GetPlugin(pluginID string) *plugins.PluginV2 {
	m.pluginsMu.RLock()
	p, ok := m.plugins[pluginID]
	m.pluginsMu.RUnlock()

	if ok && p.IsDecommissioned() {
		return nil
	}

	return p
}

func (m *PluginManagerV2) DataSource(pluginID string) {

}

func (m *PluginManagerV2) Panel(pluginID string) {

}

func (m *PluginManagerV2) App(pluginID string) {

}

func (m *PluginManagerV2) Renderer() *plugins.PluginV2 {
	for _, p := range m.plugins {
		if p.IsRenderer() {
			return p
		}
	}
	return nil
}

func (m *PluginManagerV2) DataSources() {

}

func (m *PluginManagerV2) Apps() {

}

func (m *PluginManagerV2) Panels() {

}

func (m *PluginManagerV2) Plugins() {

}

func (m *PluginManagerV2) Errors(pluginID string) {
	//m.PluginLoader.errors
}

func (m *PluginManagerV2) StaticRoutes() []*plugins.PluginStaticRoute {
	var staticRoutes []*plugins.PluginStaticRoute
	for _, plugin := range m.plugins {
		staticRoutes = append(staticRoutes, plugin.GetStaticRoutes()...)
	}

	return staticRoutes
}

func (m *PluginManagerV2) CallResource(pCtx backend.PluginContext, reqCtx *models.ReqContext, path string) {
	var dsURL string
	if pCtx.DataSourceInstanceSettings != nil {
		dsURL = pCtx.DataSourceInstanceSettings.URL
	}

	err := m.PluginRequestValidator.Validate(dsURL, reqCtx.Req.Request)
	if err != nil {
		reqCtx.JsonApiErr(http.StatusForbidden, "Access denied", err)
		return
	}

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

func (m *PluginManagerV2) callResourceInternal(w http.ResponseWriter, req *http.Request, pCtx backend.PluginContext) error {
	p := m.GetPlugin(pCtx.PluginID)
	if p == nil {
		return backendplugin.ErrPluginNotRegistered
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
		return fmt.Errorf("failed to read request body: %w", err)
	}

	crReq := &backend.CallResourceRequest{
		PluginContext: pCtx,
		Path:          req.URL.Path,
		Method:        req.Method,
		URL:           req.URL.String(),
		Headers:       req.Header,
		Body:          body,
	}

	return instrumentation.InstrumentCallResourceRequest(p.PluginID(), func() error {
		childCtx, cancel := context.WithCancel(req.Context())
		defer cancel()
		stream := newCallResourceResponseStream(childCtx)

		var wg sync.WaitGroup
		wg.Add(1)

		defer func() {
			if err := stream.Close(); err != nil {
				m.log.Warn("Failed to close stream", "err", err)
			}
			wg.Wait()
		}()

		var flushStreamErr error
		go func() {
			flushStreamErr = flushStream(p, stream, w)
			wg.Done()
		}()

		if err := p.CallResource(req.Context(), crReq, stream); err != nil {
			return err
		}

		return flushStreamErr
	})
}

func handleCallResourceError(err error, reqCtx *models.ReqContext) {
	if errors.Is(err, backendplugin.ErrPluginUnavailable) {
		reqCtx.JsonApiErr(503, "Plugin unavailable", err)
		return
	}

	if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
		reqCtx.JsonApiErr(404, "Not found", err)
		return
	}

	reqCtx.JsonApiErr(500, "Failed to call resource", err)
}

func flushStream(plugin backendplugin.Plugin, stream callResourceClientResponseStream, w http.ResponseWriter) error {
	processedStreams := 0

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if processedStreams == 0 {
				return errors.New("received empty resource response")
			}
			return nil
		}
		if err != nil {
			if processedStreams == 0 {
				return errutil.Wrap("failed to receive response from resource call", err)
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
					// TODO: Figure out if we should use Set here instead
					// nolint:gocritic
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

func (m *PluginManagerV2) CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error) {
	p := m.GetPlugin(pluginID)
	if p == nil {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CollectMetricsResult
	err := instrumentation.InstrumentCollectMetrics(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CollectMetrics(ctx)
		return
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (m *PluginManagerV2) CheckHealth(ctx context.Context, pluginContext backend.PluginContext) (*backend.CheckHealthResult, error) {
	var dsURL string
	if pluginContext.DataSourceInstanceSettings != nil {
		dsURL = pluginContext.DataSourceInstanceSettings.URL
	}

	err := m.PluginRequestValidator.Validate(dsURL, nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  http.StatusForbidden,
			Message: "Access denied",
		}, nil
	}

	p := m.GetPlugin(pluginContext.PluginID)
	if p == nil {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CheckHealthResult
	err = instrumentation.InstrumentCheckHealthRequest(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: pluginContext})
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, errutil.Wrap("failed to check plugin health", backendplugin.ErrHealthCheckFailed)
	}

	return resp, nil
}

func (m *PluginManagerV2) Register(p *plugins.PluginV2) error {
	m.log.Debug("Registering plugin", "pluginId", p.ID)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	pluginID := p.ID
	if _, exists := m.plugins[pluginID]; exists {
		return fmt.Errorf("plugin %s already registered", pluginID)
	}

	m.plugins[pluginID] = p
	m.log.Debug("Plugin registered", "pluginId", pluginID)
	return nil
}

func (m *PluginManagerV2) registerAndStart(ctx context.Context, plugin *plugins.PluginV2) error {
	err := m.Register(plugin)
	if err != nil {
		return err
	}

	if !m.IsRegistered(plugin.ID) {
		return fmt.Errorf("plugin %s is not registered", plugin.ID)
	}

	m.start(ctx, plugin)

	return nil
}

func (m *PluginManagerV2) UnregisterAndStop(ctx context.Context, pluginID string) error {
	m.log.Debug("Unregistering plugin", "pluginId", pluginID)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	p := m.GetPlugin(pluginID)
	if p == nil {
		return fmt.Errorf("plugin %s is not registered", pluginID)
	}

	m.log.Debug("Stopping plugin process", "pluginId", pluginID)
	if err := p.Decommission(); err != nil {
		return err
	}

	if err := p.Stop(ctx); err != nil {
		return err
	}

	delete(m.plugins, pluginID)

	m.log.Debug("Plugin unregistered", "pluginId", pluginID)
	return nil
}

func (m *PluginManagerV2) IsEnabled() bool {
	return !m.IsDisabled()
}

func (m *PluginManagerV2) IsRegistered(pluginID string) bool {
	p := m.GetPlugin(pluginID)
	if p == nil {
		return false
	}

	return !p.IsDecommissioned()
}

func (m *PluginManagerV2) IsSupported(pluginID string) bool {
	for pID := range m.plugins {
		if pID == pluginID {
			return true
		}
	}
	return false
}

func (m *PluginManagerV2) Install(ctx context.Context, pluginID, version string) error {
	plugin := m.GetPlugin(pluginID)
	if plugin != nil {
		if plugin.IsCorePlugin {
			return plugins.ErrInstallCorePlugin
		}

		if plugin.Info.Version == version {
			return plugins.DuplicatePluginError{
				PluginID:          pluginID,
				ExistingPluginDir: plugin.PluginDir,
			}
		}

		// remove existing installation of plugin
		err := m.Uninstall(context.Background(), plugin.ID)
		if err != nil {
			return err
		}
	}

	err := m.pluginInstaller.Install(ctx, pluginID, version, m.Cfg.PluginsPath, "", grafanaComURL)
	if err != nil {
		return err
	}

	err = m.installPlugins(m.Cfg.PluginsPath, true)
	if err != nil {
		return err
	}

	return nil
}

func (m *PluginManagerV2) Uninstall(ctx context.Context, pluginID string) error {
	plugin := m.GetPlugin(pluginID)
	if plugin == nil {
		return plugins.ErrPluginNotInstalled
	}

	if plugin.IsCorePlugin {
		return plugins.ErrUninstallCorePlugin
	}

	// extra security check to ensure we only remove plugins that are located in the configured plugins directory
	path, err := filepath.Rel(m.Cfg.PluginsPath, plugin.PluginDir)
	if err != nil || strings.HasPrefix(path, ".."+string(filepath.Separator)) {
		return plugins.ErrUninstallOutsideOfPluginDir
	}

	if m.IsRegistered(pluginID) {
		err := m.UnregisterAndStop(ctx, pluginID)
		if err != nil {
			return err
		}
	}

	err = m.unregister(plugin)
	if err != nil {
		return err
	}

	return m.pluginInstaller.Uninstall(ctx, pluginID, m.Cfg.PluginsPath)
}

func (m *PluginManagerV2) unregister(plugin *plugins.PluginV2) error {
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	delete(m.plugins, plugin.ID)

	return nil
}

// start starts all managed backend plugins
func (m *PluginManagerV2) start(ctx context.Context, p *plugins.PluginV2) {
	if !p.IsManaged() || !p.Backend {
		return
	}

	if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
		p.Logger().Error("Failed to start plugin", "error", err)
	}
}

func (m *PluginManagerV2) stop(ctx context.Context) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	var wg sync.WaitGroup
	for _, p := range m.plugins {
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

func startPluginAndRestartKilledProcesses(ctx context.Context, p *plugins.PluginV2) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p *plugins.PluginV2) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func restartKilledProcess(ctx context.Context, p *plugins.PluginV2) error {
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

// callResourceClientResponseStream is used for receiving resource call responses.
type callResourceClientResponseStream interface {
	Recv() (*backend.CallResourceResponse, error)
	Close() error
}

type keepCookiesJSONModel struct {
	KeepCookies []string `json:"keepCookies"`
}

type callResourceResponseStream struct {
	ctx    context.Context
	stream chan *backend.CallResourceResponse
	closed bool
}

func newCallResourceResponseStream(ctx context.Context) *callResourceResponseStream {
	return &callResourceResponseStream{
		ctx:    ctx,
		stream: make(chan *backend.CallResourceResponse),
	}
}

func (s *callResourceResponseStream) Send(res *backend.CallResourceResponse) error {
	if s.closed {
		return errors.New("cannot send to a closed stream")
	}

	select {
	case <-s.ctx.Done():
		return errors.New("cancelled")
	case s.stream <- res:
		return nil
	}
}

func (s *callResourceResponseStream) Recv() (*backend.CallResourceResponse, error) {
	select {
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	case res, ok := <-s.stream:
		if !ok {
			return nil, io.EOF
		}
		return res, nil
	}
}

func (s *callResourceResponseStream) Close() error {
	if s.closed {
		return errors.New("cannot close a closed stream")
	}

	close(s.stream)
	s.closed = true
	return nil
}
