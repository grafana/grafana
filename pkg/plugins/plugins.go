package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"path"
	"runtime"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/oauth"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrFileNotExist              = errors.New("file does not exist")
	ErrPluginFileRead            = errors.New("file could not be read")
	ErrUninstallInvalidPluginDir = errors.New("cannot recognize as plugin folder")
	ErrInvalidPluginJSON         = errors.New("did not find valid type or id properties in plugin.json")
)

type Plugin struct {
	JSONData

	FS    FS
	Class Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      SignatureStatus
	SignatureType  SignatureType
	SignatureOrg   string
	Parent         *Plugin
	Children       []*Plugin
	SignatureError *SignatureError

	// SystemJS fields
	Module  string
	BaseURL string

	AngularDetected bool

	ExternalService *oauth.ExternalService

	Renderer       pluginextensionv2.RendererPlugin
	SecretsManager secretsmanagerplugin.SecretsManagerPlugin
	client         backendplugin.Plugin
	log            log.Logger

	// This will be moved to plugin.json when we have general support in gcom
	Alias string `json:"alias,omitempty"`
}

type PluginDTO struct {
	JSONData

	fs                FS
	logger            log.Logger
	supportsStreaming bool

	Class Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      SignatureStatus
	SignatureType  SignatureType
	SignatureOrg   string
	SignatureError *SignatureError

	// SystemJS fields
	Module  string
	BaseURL string

	AngularDetected bool

	// This will be moved to plugin.json when we have general support in gcom
	Alias string `json:"alias,omitempty"`
}

func (p PluginDTO) SupportsStreaming() bool {
	return p.supportsStreaming
}

func (p PluginDTO) Base() string {
	return p.fs.Base()
}

func (p PluginDTO) IsApp() bool {
	return p.Type == TypeApp
}

func (p PluginDTO) IsCorePlugin() bool {
	return p.Class == ClassCore
}

// JSONData represents the plugin's plugin.json
type JSONData struct {
	// Common settings
	ID           string       `json:"id"`
	Type         Type         `json:"type"`
	Name         string       `json:"name"`
	Alias        string       `json:"alias,omitempty"`
	Info         Info         `json:"info"`
	Dependencies Dependencies `json:"dependencies"`
	Includes     []*Includes  `json:"includes"`
	State        ReleaseState `json:"state,omitempty"`
	Category     string       `json:"category"`
	HideFromList bool         `json:"hideFromList,omitempty"`
	Preload      bool         `json:"preload"`
	Backend      bool         `json:"backend"`
	Routes       []*Route     `json:"routes"`

	// AccessControl settings
	Roles []RoleRegistration `json:"roles,omitempty"`

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

	// Backend (Datasource + Renderer + SecretsManager)
	Executable string `json:"executable,omitempty"`

	// Oauth App Service Registration
	ExternalServiceRegistration *plugindef.ExternalServiceRegistration `json:"externalServiceRegistration,omitempty"`
}

func ReadPluginJSON(reader io.Reader) (JSONData, error) {
	plugin := JSONData{}
	if err := json.NewDecoder(reader).Decode(&plugin); err != nil {
		return JSONData{}, err
	}

	if err := validatePluginJSON(plugin); err != nil {
		return JSONData{}, err
	}

	// Hardcoded changes
	switch plugin.ID {
	case "grafana-piechart-panel":
		plugin.Name = "Pie Chart (old)"
	case "grafana-pyroscope-datasource": // rebranding
		plugin.Alias = "phlare"
	case "debug": // panel plugin used for testing
		plugin.Alias = "debugX"
	}

	if len(plugin.Dependencies.Plugins) == 0 {
		plugin.Dependencies.Plugins = []Dependency{}
	}

	if plugin.Dependencies.GrafanaVersion == "" {
		plugin.Dependencies.GrafanaVersion = "*"
	}

	for _, include := range plugin.Includes {
		if include.Role == "" {
			include.Role = org.RoleViewer
		}
	}

	return plugin, nil
}

func validatePluginJSON(data JSONData) error {
	if data.ID == "" || !data.Type.IsValid() {
		return ErrInvalidPluginJSON
	}
	return nil
}

func (d JSONData) DashboardIncludes() []*Includes {
	result := []*Includes{}
	for _, include := range d.Includes {
		if include.Type == TypeDashboard {
			result = append(result, include)
		}
	}

	return result
}

// Route describes a plugin route that is defined in
// the plugin.json file for a plugin.
type Route struct {
	Path         string          `json:"path"`
	Method       string          `json:"method"`
	ReqRole      org.RoleType    `json:"reqRole"`
	URL          string          `json:"url"`
	URLParams    []URLParam      `json:"urlParams"`
	Headers      []Header        `json:"headers"`
	AuthType     string          `json:"authType"`
	TokenAuth    *JWTTokenAuth   `json:"tokenAuth"`
	JwtTokenAuth *JWTTokenAuth   `json:"jwtTokenAuth"`
	Body         json.RawMessage `json:"body"`
}

// Header describes an HTTP header that is forwarded with
// the proxied request for a plugin route
type Header struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// URLParam describes query string parameters for
// a url in a plugin route
type URLParam struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// JWTTokenAuth struct is both for normal Token Auth and JWT Token Auth with
// an uploaded JWT file.
type JWTTokenAuth struct {
	Url    string            `json:"url"`
	Scopes []string          `json:"scopes"`
	Params map[string]string `json:"params"`
}

func (p *Plugin) PluginID() string {
	return p.ID
}

func (p *Plugin) Logger() log.Logger {
	return p.log
}

func (p *Plugin) SetLogger(l log.Logger) {
	p.log = l
}

func (p *Plugin) Start(ctx context.Context) error {
	if p.client == nil {
		return fmt.Errorf("could not start plugin %s as no plugin client exists", p.ID)
	}
	return p.client.Start(ctx)
}

func (p *Plugin) Stop(ctx context.Context) error {
	if p.client == nil {
		return nil
	}
	return p.client.Stop(ctx)
}

func (p *Plugin) IsManaged() bool {
	if p.client != nil {
		return p.client.IsManaged()
	}
	return false
}

func (p *Plugin) Decommission() error {
	if p.client != nil {
		return p.client.Decommission()
	}
	return nil
}

func (p *Plugin) IsDecommissioned() bool {
	if p.client != nil {
		return p.client.IsDecommissioned()
	}
	return false
}

func (p *Plugin) Exited() bool {
	if p.client != nil {
		return p.client.Exited()
	}
	return false
}

func (p *Plugin) Target() backendplugin.Target {
	if !p.Backend {
		return backendplugin.TargetNone
	}
	if p.client == nil {
		return backendplugin.TargetUnknown
	}
	return p.client.Target()
}

func (p *Plugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.QueryData(ctx, req)
}

func (p *Plugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	pluginClient, ok := p.Client()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CallResource(ctx, req, sender)
}

func (p *Plugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CheckHealth(ctx, req)
}

func (p *Plugin) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.CollectMetrics(ctx, req)
}

func (p *Plugin) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.SubscribeStream(ctx, req)
}

func (p *Plugin) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	pluginClient, ok := p.Client()
	if !ok {
		return nil, backendplugin.ErrPluginUnavailable
	}
	return pluginClient.PublishStream(ctx, req)
}

func (p *Plugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	pluginClient, ok := p.Client()
	if !ok {
		return backendplugin.ErrPluginUnavailable
	}
	return pluginClient.RunStream(ctx, req, sender)
}

func (p *Plugin) File(name string) (fs.File, error) {
	cleanPath, err := util.CleanRelativePath(name)
	if err != nil {
		// CleanRelativePath should clean and make the path relative so this is not expected to fail
		return nil, err
	}

	if p.FS == nil {
		return nil, ErrFileNotExist
	}

	f, err := p.FS.Open(cleanPath)
	if err != nil {
		return nil, err
	}

	return f, nil
}

func (p *Plugin) RegisterClient(c backendplugin.Plugin) {
	p.client = c
}

func (p *Plugin) Client() (PluginClient, bool) {
	if p.client != nil {
		return p.client, true
	}
	return nil, false
}

func (p *Plugin) ExecutablePath() string {
	if p.IsRenderer() {
		return p.executablePath("plugin_start")
	}

	if p.IsSecretsManager() {
		return p.executablePath("secrets_plugin_start")
	}

	return p.executablePath(p.Executable)
}

func (p *Plugin) executablePath(f string) string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}
	return path.Join(p.FS.Base(), fmt.Sprintf("%s_%s_%s%s", f, os, strings.ToLower(arch), extension))
}

type PluginClient interface {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

func (p *Plugin) ToDTO() PluginDTO {
	return PluginDTO{
		logger:            p.Logger(),
		fs:                p.FS,
		supportsStreaming: p.client != nil && p.client.(backend.StreamHandler) != nil,
		Class:             p.Class,
		JSONData:          p.JSONData,
		IncludedInAppID:   p.IncludedInAppID,
		DefaultNavURL:     p.DefaultNavURL,
		Pinned:            p.Pinned,
		Signature:         p.Signature,
		SignatureType:     p.SignatureType,
		SignatureOrg:      p.SignatureOrg,
		SignatureError:    p.SignatureError,
		Module:            p.Module,
		BaseURL:           p.BaseURL,
		AngularDetected:   p.AngularDetected,
		Alias:             p.Alias,
	}
}

func (p *Plugin) StaticRoute() *StaticRoute {
	if p.IsCorePlugin() {
		return nil
	}

	if p.FS == nil {
		return nil
	}

	return &StaticRoute{Directory: p.FS.Base(), PluginID: p.ID}
}

func (p *Plugin) IsRenderer() bool {
	return p.Type == TypeRenderer
}

func (p *Plugin) IsSecretsManager() bool {
	return p.Type == TypeSecretsManager
}

func (p *Plugin) IsApp() bool {
	return p.Type == TypeApp
}

func (p *Plugin) IsCorePlugin() bool {
	return p.Class == ClassCore
}

func (p *Plugin) IsBundledPlugin() bool {
	return p.Class == ClassBundled
}

func (p *Plugin) IsExternalPlugin() bool {
	return !p.IsCorePlugin() && !p.IsBundledPlugin()
}

type Class string

const (
	ClassCore     Class = "core"
	ClassBundled  Class = "bundled"
	ClassExternal Class = "external"
)

func (c Class) String() string {
	return string(c)
}

var PluginTypes = []Type{
	TypeDataSource,
	TypePanel,
	TypeApp,
	TypeRenderer,
	TypeSecretsManager,
}

type Type string

const (
	TypeDataSource     Type = "datasource"
	TypePanel          Type = "panel"
	TypeApp            Type = "app"
	TypeRenderer       Type = "renderer"
	TypeSecretsManager Type = "secretsmanager"
)

func (pt Type) IsValid() bool {
	switch pt {
	case TypeDataSource, TypePanel, TypeApp, TypeRenderer, TypeSecretsManager:
		return true
	}
	return false
}
