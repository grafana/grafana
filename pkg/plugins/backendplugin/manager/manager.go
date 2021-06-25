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
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

func init() {
	registry.RegisterServiceWithPriority(&manager{
		logger:  log.New("plugins.backend"),
		plugins: map[string]backendplugin.Plugin{},
	}, registry.MediumHigh)
}

type manager struct {
	Cfg                    *setting.Cfg                  `inject:""`
	License                models.Licensing              `inject:""`
	PluginRequestValidator models.PluginRequestValidator `inject:""`
	pluginsMu              sync.RWMutex
	plugins                map[string]backendplugin.Plugin
	logger                 log.Logger
}

func (m *manager) Init() error {
	return nil
}

func (m *manager) Run(ctx context.Context) error {
	<-ctx.Done()
	m.stop(ctx)
	return ctx.Err()
}

// Register registers a backend plugin
func (m *manager) Register(pluginID string, factory backendplugin.PluginFactoryFunc) error {
	m.logger.Debug("Registering backend plugin", "pluginId", pluginID)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	if _, exists := m.plugins[pluginID]; exists {
		return fmt.Errorf("backend plugin %s already registered", pluginID)
	}

	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", m.Cfg.BuildVersion),
		fmt.Sprintf("GF_EDITION=%s", m.License.Edition()),
	}

	if m.License.HasLicense() {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_PATH=%s", m.Cfg.EnterpriseLicensePath),
		)

		if envProvider, ok := m.License.(models.LicenseEnvironment); ok {
			for k, v := range envProvider.Environment() {
				hostEnv = append(hostEnv, fmt.Sprintf("%s=%s", k, v))
			}
		}
	}

	hostEnv = append(hostEnv, m.getAWSEnvironmentVariables()...)
	hostEnv = append(hostEnv, m.getAzureEnvironmentVariables()...)

	pluginSettings := getPluginSettings(pluginID, m.Cfg)
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

// RegisterAndStart registers and starts a backend plugin
func (m *manager) RegisterAndStart(ctx context.Context, pluginID string, factory backendplugin.PluginFactoryFunc) error {
	err := m.Register(pluginID, factory)
	if err != nil {
		return err
	}

	p, exists := m.Get(pluginID)
	if !exists {
		return fmt.Errorf("backend plugin %s is not registered", pluginID)
	}

	m.start(ctx, p)

	return nil
}

// UnregisterAndStop unregisters and stops a backend plugin
func (m *manager) UnregisterAndStop(ctx context.Context, pluginID string) error {
	m.logger.Debug("Unregistering backend plugin", "pluginId", pluginID)
	m.pluginsMu.Lock()
	defer m.pluginsMu.Unlock()

	p, exists := m.plugins[pluginID]
	if !exists {
		return fmt.Errorf("backend plugin %s is not registered", pluginID)
	}

	m.logger.Debug("Stopping backend plugin process", "pluginId", pluginID)
	if err := p.Decommission(); err != nil {
		return err
	}

	if err := p.Stop(ctx); err != nil {
		return err
	}

	delete(m.plugins, pluginID)

	m.logger.Debug("Backend plugin unregistered", "pluginId", pluginID)
	return nil
}

func (m *manager) IsRegistered(pluginID string) bool {
	p, _ := m.Get(pluginID)

	return p != nil && !p.IsDecommissioned()
}

func (m *manager) Get(pluginID string) (backendplugin.Plugin, bool) {
	m.pluginsMu.RLock()
	p, ok := m.plugins[pluginID]
	m.pluginsMu.RUnlock()

	if ok && p.IsDecommissioned() {
		return nil, false
	}

	return p, ok
}

func (m *manager) getAWSEnvironmentVariables() []string {
	variables := []string{}
	if m.Cfg.AWSAssumeRoleEnabled {
		variables = append(variables, awsds.AssumeRoleEnabledEnvVarKeyName+"=true")
	}
	if len(m.Cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, awsds.AllowedAuthProvidersEnvVarKeyName+"="+strings.Join(m.Cfg.AWSAllowedAuthProviders, ","))
	}

	return variables
}

func (m *manager) getAzureEnvironmentVariables() []string {
	variables := []string{}
	if m.Cfg.Azure.Cloud != "" {
		variables = append(variables, "AZURE_CLOUD="+m.Cfg.Azure.Cloud)
	}
	if m.Cfg.Azure.ManagedIdentityClientId != "" {
		variables = append(variables, "AZURE_MANAGED_IDENTITY_CLIENT_ID="+m.Cfg.Azure.ManagedIdentityClientId)
	}
	if m.Cfg.Azure.ManagedIdentityEnabled {
		variables = append(variables, "AZURE_MANAGED_IDENTITY_ENABLED=true")
	}

	return variables
}

// start starts a managed backend plugin
func (m *manager) start(ctx context.Context, p backendplugin.Plugin) {
	if !p.IsManaged() {
		return
	}

	if err := startPluginAndRestartKilledProcesses(ctx, p); err != nil {
		p.Logger().Error("Failed to start plugin", "error", err)
	}
}

// StartPlugin starts a non-managed backend plugin
func (m *manager) StartPlugin(ctx context.Context, pluginID string) error {
	m.pluginsMu.RLock()
	p, registered := m.plugins[pluginID]
	m.pluginsMu.RUnlock()
	if !registered {
		return backendplugin.ErrPluginNotRegistered
	}

	if p.IsManaged() {
		return errors.New("backend plugin is managed and cannot be manually started")
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

// CollectMetrics collects metrics from a registered backend plugin.
func (m *manager) CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error) {
	p, registered := m.Get(pluginID)
	if !registered {
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

// CheckHealth checks the health of a registered backend plugin.
func (m *manager) CheckHealth(ctx context.Context, pluginContext backend.PluginContext) (*backend.CheckHealthResult, error) {
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

	p, registered := m.Get(pluginContext.PluginID)
	if !registered {
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

func (m *manager) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	p, registered := m.Get(req.PluginContext.PluginID)
	if !registered {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.QueryData(ctx, req)
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

	return resp, nil
}

type keepCookiesJSONModel struct {
	KeepCookies []string `json:"keepCookies"`
}

func (m *manager) callResourceInternal(w http.ResponseWriter, req *http.Request, pCtx backend.PluginContext) error {
	p, registered := m.Get(pCtx.PluginID)
	if !registered {
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
				m.logger.Warn("Failed to close stream", "err", err)
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

// CallResource calls a plugin resource.
func (m *manager) CallResource(pCtx backend.PluginContext, reqCtx *models.ReqContext, path string) {
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

func startPluginAndRestartKilledProcesses(ctx context.Context, p backendplugin.Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	go func(ctx context.Context, p backendplugin.Plugin) {
		if err := restartKilledProcess(ctx, p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(ctx, p)

	return nil
}

func restartKilledProcess(ctx context.Context, p backendplugin.Plugin) error {
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
