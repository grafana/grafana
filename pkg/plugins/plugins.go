package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/plugins/manifest"
	"github.com/grafana/grafana/pkg/plugins/signature"
	"github.com/grafana/grafana/pkg/setting"
)

type Plugin struct {
	JSONData

	PluginDir string
	Class     Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      signature.Status
	SignatureType  manifest.Type
	SignatureOrg   string
	Parent         *Plugin
	Children       []*Plugin
	SignedFiles    PluginFiles
	SignatureError *signature.Error

	// SystemJS fields
	Module  string
	BaseURL string

	Renderer       pluginextensionv2.RendererPlugin
	SecretsManager secretsmanagerplugin.SecretsManagerPlugin
	client         backendplugin.Plugin
	log            log.Logger
}

type PluginDTO struct {
	JSONData

	PluginDir string
	Class     Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      signature.Status
	SignatureType  manifest.Type
	SignatureOrg   string
	SignedFiles    PluginFiles
	SignatureError *signature.Error

	// SystemJS fields
	Module  string
	BaseURL string

	// temporary
	backend.StreamHandler
}

func (p PluginDTO) SupportsStreaming() bool {
	return p.StreamHandler != nil
}

func (p PluginDTO) IsApp() bool {
	return p.Type == App
}

func (p PluginDTO) IsCorePlugin() bool {
	return p.Class == Core
}

func (p PluginDTO) IncludedInSignature(file string) bool {
	// permit Core plugin files
	if p.IsCorePlugin() {
		return true
	}

	// permit when no signed files (no MANIFEST)
	if p.SignedFiles == nil {
		return true
	}

	if _, exists := p.SignedFiles[file]; !exists {
		return false
	}
	return true
}

// JSONData represents the plugin's plugin.json
type JSONData struct {
	// Common settings
	ID           string       `json:"id"`
	Type         Type         `json:"type"`
	Name         string       `json:"name"`
	Info         Info         `json:"info"`
	Dependencies Dependencies `json:"dependencies"`
	Includes     []*Includes  `json:"includes"`
	State        ReleaseState `json:"state,omitempty"`
	Category     string       `json:"category"`
	HideFromList bool         `json:"hideFromList,omitempty"`
	Preload      bool         `json:"preload"`
	Backend      bool         `json:"backend"`
	Routes       []*Route     `json:"routes"`

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
	ReqRole      models.RoleType `json:"reqRole"`
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
	if p.log == nil {
		return log.New()
	}

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

func (p *Plugin) RegisterClient(c backendplugin.Plugin) {
	p.client = c
}

func (p *Plugin) Client() (PluginClient, bool) {
	if p.client != nil {
		return p.client, true
	}
	return nil, false
}

func (p *Plugin) CalculateSignature() error {
	if p.IsCorePlugin() {
		p.Signature = signature.Internal
		return nil
	}

	pluginFiles, err := p.filesRequiringVerification()
	if err != nil {
		p.Logger().Warn("Could not collect plugin file information in directory", "pluginID", p.ID, "dir", p.PluginDir)
		p.Signature = signature.Invalid
		return err
	}

	manifestPath := filepath.Join(p.PluginDir, "MANIFEST.txt")

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `manifestPath` is based
	// on plugin the folder structure on disk and not user input.
	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		p.Logger().Debug("Plugin is unsigned", "id", p.ID)
		p.Signature = signature.Unsigned
		return nil
	}

	m, err := manifest.ReadPluginManifest(byteValue)
	if err != nil {
		p.Logger().Debug("Plugin signature invalid", "id", p.ID)
		p.Signature = signature.Invalid
		return nil
	}

	// Make sure the versions all match
	if m.Plugin != p.ID || m.Version != p.Info.Version {
		p.Signature = signature.Modified
		return nil
	}

	// Validate that private is running within defined root URLs
	if m.SignatureType == manifest.Private {
		appURL, err := url.Parse(setting.AppUrl)
		if err != nil {
			return err
		}

		foundMatch := false
		for _, u := range m.RootURLs {
			rootURL, err := url.Parse(u)
			if err != nil {
				p.Logger().Warn("Could not parse plugin root URL", "plugin", p.ID, "rootUrl", rootURL)
				return err
			}

			if rootURL.Scheme == appURL.Scheme &&
				rootURL.Host == appURL.Host &&
				path.Clean(rootURL.RequestURI()) == path.Clean(appURL.RequestURI()) {
				foundMatch = true
				break
			}
		}

		if !foundMatch {
			p.Logger().Warn("Could not find root URL that matches running application URL", "plugin", p.ID,
				"appUrl", appURL, "rootUrls", m.RootURLs)
			p.Signature = signature.Invalid
			return nil
		}
	}

	// Verify the manifest contents
	manifestFiles := make(map[string]struct{}, len(m.Files))
	for fp, hash := range m.Files {
		err = manifest.VerifyHash(p.Logger(), filepath.Join(p.PluginDir, fp), hash)
		if err != nil {
			p.Signature = signature.Modified
			return nil
		}

		manifestFiles[fp] = struct{}{}
	}

	if m.IsV2() {

		// Track files missing from the manifest
		var unsignedFiles []string
		for _, f := range pluginFiles {
			if _, exists := manifestFiles[f]; !exists {
				unsignedFiles = append(unsignedFiles, f)
			}
		}

		if len(unsignedFiles) > 0 {
			p.Logger().Warn("The following files were not included in the signature", "plugin", p.ID, "files", unsignedFiles)
			p.Signature = signature.Modified
			//p.SignedFiles = manifestFiles

			return nil
		}
	}

	p.Logger().Debug("Plugin signature valid", "id", p.ID)

	p.Signature = signature.Valid
	p.SignatureType = m.SignatureType
	p.SignatureOrg = m.SignedByOrgName
	//p.SignedFiles = manifestFiles

	return nil
}

// pluginFilesRequiringVerification gets plugin filenames that require verification for plugin signing
// returns filenames as a slice of posix style paths relative to plugin directory
func (p *Plugin) filesRequiringVerification() ([]string, error) {
	var files []string
	err := filepath.Walk(p.PluginDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.Mode()&os.ModeSymlink == os.ModeSymlink {
			symlinkPath, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}

			symlink, err := os.Stat(symlinkPath)
			if err != nil {
				return err
			}

			// verify that symlinked file is within plugin directory
			p, err := filepath.Rel(p.PluginDir, symlinkPath)
			if err != nil {
				return err
			}
			if p == ".." || strings.HasPrefix(p, ".."+string(filepath.Separator)) {
				return fmt.Errorf("file '%s' not inside of plugin directory", p)
			}

			// skip symlink directories
			if symlink.IsDir() {
				return nil
			}
		}

		// skip directories and MANIFEST.txt
		if info.IsDir() || info.Name() == "MANIFEST.txt" {
			return nil
		}

		// verify that file is within plugin directory
		file, err := filepath.Rel(p.PluginDir, path)
		if err != nil {
			return err
		}
		if strings.HasPrefix(file, ".."+string(filepath.Separator)) {
			return fmt.Errorf("file '%s' not inside of plugin directory", file)
		}

		files = append(files, filepath.ToSlash(file))

		return nil
	})

	return files, err
}

type PluginClient interface {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

func (p *Plugin) ToDTO() PluginDTO {
	c, _ := p.Client()

	return PluginDTO{
		JSONData:        p.JSONData,
		PluginDir:       p.PluginDir,
		Class:           p.Class,
		IncludedInAppID: p.IncludedInAppID,
		DefaultNavURL:   p.DefaultNavURL,
		Pinned:          p.Pinned,
		Signature:       p.Signature,
		SignatureType:   p.SignatureType,
		SignatureOrg:    p.SignatureOrg,
		SignedFiles:     p.SignedFiles,
		SignatureError:  p.SignatureError,
		Module:          p.Module,
		BaseURL:         p.BaseURL,
		StreamHandler:   c,
	}
}

func (p *Plugin) StaticRoute() *StaticRoute {
	if p.IsCorePlugin() {
		return nil
	}

	return &StaticRoute{Directory: p.PluginDir, PluginID: p.ID}
}

func (p *Plugin) IsRenderer() bool {
	return p.Type == "renderer"
}

func (p *Plugin) IsSecretsManager() bool {
	return p.Type == "secretsmanager"
}

func (p *Plugin) IsDataSource() bool {
	return p.Type == "datasource"
}

func (p *Plugin) IsPanel() bool {
	return p.Type == "panel"
}

func (p *Plugin) IsApp() bool {
	return p.Type == "app"
}

func (p *Plugin) IsCorePlugin() bool {
	return p.Class == Core
}

func (p *Plugin) IsBundledPlugin() bool {
	return p.Class == Bundled
}

func (p *Plugin) IsExternalPlugin() bool {
	return p.Class == External
}

type Class string

const (
	Core     Class = "core"
	Bundled  Class = "bundled"
	External Class = "external"
)

var PluginTypes = []Type{
	DataSource,
	Panel,
	App,
	Renderer,
	SecretsManager,
}

type Type string

const (
	DataSource     Type = "datasource"
	Panel          Type = "panel"
	App            Type = "app"
	Renderer       Type = "renderer"
	SecretsManager Type = "secretsmanager"
)

func (pt Type) IsValid() bool {
	switch pt {
	case DataSource, Panel, App, Renderer, SecretsManager:
		return true
	}
	return false
}
