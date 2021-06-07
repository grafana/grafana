// Package plugins contains plugin related logic.
package plugins

import (
	"context"
	"errors"
	"path/filepath"
	"sync"

	"github.com/hashicorp/go-plugin"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	grpcplugin2 "github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	goplugin "github.com/hashicorp/go-plugin"
)

var _ backendplugin.Plugin = (*PluginV2)(nil)

type PluginV2 struct {
	Client      PluginClient
	hashiClient *plugin.Client
	descriptor  grpcplugin.PluginDescriptor

	BackendClient backendplugin.Plugin

	logger         glog.Logger
	mutex          sync.RWMutex
	decommissioned bool

	// Common settings
	Type         string                `json:"type"`
	Name         string                `json:"name"`
	ID           string                `json:"id"`
	Info         PluginInfo            `json:"info"`
	Dependencies PluginDependencies    `json:"dependencies"`
	Includes     []*PluginInclude      `json:"includes"`
	Module       string                `json:"module"`
	BaseUrl      string                `json:"baseUrl"`
	Category     string                `json:"category"`
	HideFromList bool                  `json:"hideFromList,omitempty"`
	Preload      bool                  `json:"preload"`
	State        PluginState           `json:"state,omitempty"`
	Signature    PluginSignatureStatus `json:"signature"`
	Backend      bool                  `json:"backend"`

	IncludedInAppID string              `json:"-"`
	PluginDir       string              `json:"-"`
	DefaultNavURL   string              `json:"-"`
	IsCorePlugin    bool                `json:"-"`
	SignatureType   PluginSignatureType `json:"-"`
	SignatureOrg    string              `json:"-"`

	// App settings
	AutoEnabled bool `json:"autoEnabled"`

	GrafanaNetVersion   string `json:"-"`
	GrafanaNetHasUpdate bool   `json:"-"`
	Pinned              bool   `json:"-"`

	// Datasource settings
	Annotations  bool            `json:"annotations"`
	Metrics      bool            `json:"metrics"`
	Alerting     bool            `json:"alerting"`
	Explore      bool            `json:"explore"`
	Table        bool            `json:"tables"`
	Logs         bool            `json:"logs"`
	Tracing      bool            `json:"tracing"`
	QueryOptions map[string]bool `json:"queryOptions,omitempty"`
	BuiltIn      bool            `json:"builtIn,omitempty"`
	Mixed        bool            `json:"mixed,omitempty"`
	Streaming    bool            `json:"streaming"`
	SDK          bool            `json:"sdk,omitempty"`

	// Backend (App + Datasource settings)
	Routes     []*AppPluginRoute `json:"routes"`
	Executable string            `json:"executable,omitempty"`

	Parent   *PluginV2   `json:"-"`
	Children []*PluginV2 `json:"-"`

	StaticRoutes []*PluginStaticRoute `json:"-"`
}

type InstallOpts struct {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

func (p *PluginV2) Logger() glog.Logger {
	return p.logger
}

func (p *PluginV2) PluginID() string {
	return p.ID
}

// Would be nice to see some function that could setup the backend and
// attach the data to the model as its own separate field
func (p *PluginV2) AttachBackendDetails(env []string) {
	startCmd := p.Executable
	if p.Type == "renderer" {
		startCmd = "plugin_start"
	}
	executableFilename := ComposePluginStartCommand(startCmd)

	p.descriptor = grpcplugin.PluginDescriptor{
		PluginID:       p.ID,
		ExecutablePath: filepath.Join(p.PluginDir, executableFilename),
		Env:            env,
		Managed:        true,
		VersionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin2.ProtocolVersion: grpcplugin.GetV2PluginSet(),
		},
	}
	p.logger = glog.New("pluginID", p.ID)
}

func (p *PluginV2) Start(ctx context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	clientFactory := func() *plugin.Client {
		return plugin.NewClient(grpcplugin.NewClientConfig(p.descriptor.ExecutablePath, p.descriptor.Env, p.logger, p.descriptor.VersionedPlugins))
	}
	p.hashiClient = clientFactory()
	rpcClient, err := p.hashiClient.Client()
	if err != nil {
		return err
	}

	if p.hashiClient.NegotiatedVersion() < 2 {
		return errors.New("incompatible version")
	}

	p.Client, err = newRPCClient(rpcClient)
	if err != nil {
		return err
	}

	if p.Client == nil {
		return errors.New("no compatible plugin implementation found")
	}

	return nil
}

func (p *PluginV2) Stop(ctx context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.hashiClient != nil {
		p.hashiClient.Kill()
	}
	return nil
}

func (p *PluginV2) IsManaged() bool {
	return p.descriptor.Managed
}

func (p *PluginV2) Decommission() error {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	p.decommissioned = true

	return nil
}

func (p *PluginV2) IsDecommissioned() bool {
	return p.decommissioned
}

func (p *PluginV2) Exited() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	if p.hashiClient != nil {
		return p.hashiClient.Exited()
	}
	return true
}

func (p *PluginV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.QueryData(ctx, req)
}

func (p *PluginV2) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CallResource(ctx, req, sender)
}

func (p *PluginV2) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CheckHealth(ctx, req)
}

func (p *PluginV2) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CollectMetrics(ctx)
}

func (p *PluginV2) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.SubscribeStream(ctx, req)
}

func (p *PluginV2) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.PublishStream(ctx, req)
}

func (p *PluginV2) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	pluginClient, ok := p.getPluginClient()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.RunStream(ctx, req, sender)
}

func (p *PluginV2) getPluginClient() (PluginClient, bool) {
	if p.IsCorePlugin {
		return p.getClientAsCorePlugin()
	}

	return p.getClientAsGRPCPlugin()
}

func (p *PluginV2) getClientAsGRPCPlugin() (PluginClient, bool) {
	p.mutex.RLock()
	if p.hashiClient == nil || p.hashiClient.Exited() || p.Client == nil {
		p.mutex.RUnlock()
		return nil, false
	}
	c := p.Client
	p.mutex.RUnlock()
	return c, true
}

func (p *PluginV2) getClientAsCorePlugin() (PluginClient, bool) {
	p.mutex.RLock()
	if p.Client == nil {
		p.mutex.RUnlock()
		return nil, false
	}
	c := p.Client
	p.mutex.RUnlock()
	return c, true
}
