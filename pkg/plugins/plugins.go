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

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature     PluginSignatureStatus
	SignatureType PluginSignatureType
	SignatureOrg  string
	Parent        *PluginV2
	Children      []*PluginV2

	// GCOM update checker fields
	GrafanaComVersion   string
	GrafanaComHasUpdate bool

	// SystemJS fields
	Module  string
	BaseURL string

	Renderer pluginextensionv2.RendererPlugin
	client   backendplugin.Plugin
	log      log.Logger
}

// JSONData represents the plugin's plugin.json
type JSONData struct {
	// Common settings
	ID           string             `json:"id"`
	Type         PluginType         `json:"type"`
	Name         string             `json:"name"`
	Info         PluginInfo         `json:"info"`
	Dependencies PluginDependencies `json:"dependencies"`
	Includes     []*PluginInclude   `json:"includes"`
	State        PluginState        `json:"state,omitempty"`
	Category     string             `json:"category"`
	HideFromList bool               `json:"hideFromList,omitempty"`
	Preload      bool               `json:"preload"`
	Backend      bool               `json:"backend"`

	// Panel settings
	SkipDataQuery bool `json:"skipDataQuery"`

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
	return p.log
}

func (p *PluginV2) SetLogger(l log.Logger) {
	p.log = l
}

func (p *PluginV2) Start(ctx context.Context) error {
	err := p.client.Start(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (p *PluginV2) Stop(ctx context.Context) error {
	if p.client == nil {
		return nil
	}
	err := p.client.Stop(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (p *PluginV2) IsManaged() bool {
	if p.client != nil {
		return p.client.IsManaged()
	}
	return false
}

func (p *PluginV2) Decommission() error {
	if p.client != nil {
		return p.client.Decommission()
	}
	return nil
}

func (p *PluginV2) IsDecommissioned() bool {
	if p.client != nil {
		return p.client.IsDecommissioned()
	}
	return false
}

func (p *PluginV2) Exited() bool {
	if p.client != nil {
		return p.client.Exited()
	}
	return false
}

func (p *PluginV2) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.QueryData(ctx, req)
}

func (p *PluginV2) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	pluginClient, ok := p.Client()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CallResource(ctx, req, sender)
}

func (p *PluginV2) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CheckHealth(ctx, req)
}

func (p *PluginV2) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CollectMetrics(ctx)
}

func (p *PluginV2) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.SubscribeStream(ctx, req)
}

func (p *PluginV2) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.PublishStream(ctx, req)
}

func (p *PluginV2) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	pluginClient, ok := p.Client()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.RunStream(ctx, req, sender)
}

func (p *PluginV2) RegisterClient(c backendplugin.Plugin) {
	p.client = c
}

func (p *PluginV2) Client() (PluginClient, bool) {
	if p.client != nil {
		return p.client, true
	}
	return nil, false
}

func (p *PluginV2) StaticRoute() *PluginStaticRoute {
	return &PluginStaticRoute{Directory: p.PluginDir, PluginId: p.ID}
}

func (p *PluginV2) IsRenderer() bool {
	return p.Type == "renderer"
}

func (p *PluginV2) IsDataSource() bool {
	return p.Type == "datasource"
}

func (p *PluginV2) IsPanel() bool {
	return p.Type == "panel"
}

func (p *PluginV2) IsApp() bool {
	return p.Type == "app"
}

func (p *PluginV2) IsCorePlugin() bool {
	return p.Class == Core
}

func (p *PluginV2) IsBundledPlugin() bool {
	return p.Class == Bundled
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
	Unknown  PluginClass = "unknown"
)

var PluginTypes = []PluginType{
	DataSource,
	Panel,
	App,
	Renderer,
}

type PluginType string

const (
	DataSource PluginType = "datasource"
	Panel      PluginType = "panel"
	App        PluginType = "app"
	Renderer   PluginType = "renderer"
)

func (pt PluginType) IsValid() bool {
	switch pt {
	case DataSource, Panel, App, Renderer:
		return true
	}
	return false
}
