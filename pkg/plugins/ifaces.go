package plugins

import (
	"context"
	"io/fs"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

type Installer interface {
	// Add adds a new plugin.
	Add(ctx context.Context, pluginID, version string, opts AddOpts) error
	// Remove removes an existing plugin.
	Remove(ctx context.Context, pluginID, version string) error
}

type PluginSource interface {
	PluginClass(ctx context.Context) Class
	PluginURIs(ctx context.Context) []string
	DefaultSignature(ctx context.Context, pluginID string) (Signature, bool)
}

type FileStore interface {
	// File retrieves a plugin file.
	File(ctx context.Context, pluginID, pluginVersion, filename string) (*File, error)
}

type File struct {
	Content []byte
	ModTime time.Time
}

type AddOpts struct {
	grafanaVersion string

	os   string
	arch string

	url string
}

func (co AddOpts) GrafanaVersion() string {
	return co.grafanaVersion
}

func (co AddOpts) OS() string {
	return co.os
}

func (co AddOpts) Arch() string {
	return co.arch
}

func (co AddOpts) URL() string {
	return co.url
}

func NewAddOpts(grafanaVersion, os, arch, url string) AddOpts {
	return AddOpts{grafanaVersion: grafanaVersion, arch: arch, os: os, url: url}
}

type UpdateInfo struct {
	PluginZipURL string
}

type FS interface {
	fs.FS

	Base() string
	Files() ([]string, error)
	Rel(string) (string, error)
}

type FSRemover interface {
	Remove() error
}

type FoundBundle struct {
	Primary  FoundPlugin
	Children []*FoundPlugin
}

type FoundPlugin struct {
	JSONData JSONData
	FS       FS
}

// Client is used to communicate with backend plugin implementations.
type Client interface {
	backend.Handler
}

// BackendFactoryProvider provides a backend factory for a provided plugin.
type BackendFactoryProvider interface {
	BackendFactory(ctx context.Context, p *Plugin) backendplugin.PluginFactoryFunc
}

type SecretsPluginManager interface {
	// SecretsManager returns a secretsmanager plugin
	SecretsManager(ctx context.Context) *Plugin
}

type StaticRouteResolver interface {
	Routes(ctx context.Context) []*StaticRoute
}

type ErrorResolver interface {
	PluginErrors(ctx context.Context) []*Error
	PluginError(ctx context.Context, pluginID string) *Error
}

type PluginLoaderAuthorizer interface {
	// CanLoadPlugin confirms if a plugin is authorized to load
	CanLoadPlugin(plugin *Plugin) bool
}

type Licensing interface {
	Environment() []string

	Edition() string

	Path() string

	AppURL() string
}

type SignatureCalculator interface {
	Calculate(ctx context.Context, src PluginSource, plugin FoundPlugin) (Signature, error)
}

type KeyStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key string, value any) error
	Delete(ctx context.Context, key string) error
	ListKeys(ctx context.Context) ([]string, error)
	GetLastUpdated(ctx context.Context) (time.Time, error)
	SetLastUpdated(ctx context.Context) error
}

type KeyRetriever interface {
	GetPublicKey(ctx context.Context, keyID string) (string, error)
}
