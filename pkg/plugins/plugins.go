package plugins

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

type PluginV2 struct {
	JSONData

	PluginDir string
	Class     PluginClass

	// app fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// signature fields
	SignatureType PluginSignatureType
	SignatureOrg  string
	Parent        *PluginV2
	Children      []*PluginV2

	// gcom update checker fields
	GrafanaComVersion   string
	GrafanaComHasUpdate bool

	Client   backendplugin.Plugin
	Renderer pluginextensionv2.RendererPlugin
}

// JSONData represents the plugin's plugin.json data
type JSONData struct {
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

	// App settings
	AutoEnabled bool `json:"autoEnabled"`

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

	// Backend (App + Datasource + Renderer settings)
	Routes     []*AppPluginRoute `json:"routes"`
	Executable string            `json:"executable,omitempty"`
}

func (p *PluginV2) PluginID() string {
	return p.ID
}

func (p *PluginV2) Logger() log.Logger {
	return p.Client.Logger()
}

func (p *PluginV2) Start(ctx context.Context) error {
	err := p.Client.Start(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (p *PluginV2) Stop(ctx context.Context) error {
	err := p.Client.Stop(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (p *PluginV2) IsManaged() bool {
	if p.Client != nil {
		return p.Client.IsManaged()
	}
	return false
}

func (p *PluginV2) Decommission() error {
	if p.Client != nil {
		return p.Client.Decommission()
	}
	return nil
}

func (p *PluginV2) IsDecommissioned() bool {
	if p.Client != nil {
		return p.Client.IsDecommissioned()
	}
	return false
}

func (p *PluginV2) Exited() bool {
	if p.Client != nil {
		return p.Client.Exited()
	}
	return false
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
	if p.Client != nil {
		return p.Client, true
	}
	return nil, false
}

func (p *PluginV2) GetStaticRoutes() []*PluginStaticRoute {
	return []*PluginStaticRoute{{Directory: p.PluginDir, PluginId: p.ID}}
}

func (p *PluginV2) IsRenderer() bool {
	return p.Type == "renderer"
}

func (p *PluginV2) IsCorePlugin() bool {
	return p.Class == Core
}

func (p *PluginV2) IsExternalPlugin() bool {
	return p.Class == External
}

type PluginClient interface {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

type PluginClass string

const (
	Core     PluginClass = "core"
	Bundled  PluginClass = "bundled"
	External PluginClass = "external"
)
