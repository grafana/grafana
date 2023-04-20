package plugins

import (
	"context"
	"io/fs"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

// Store is the publicly accessible storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	Plugin(ctx context.Context, pluginID string) (PluginDTO, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...Type) []PluginDTO
}

type Installer interface {
	// Add adds a new plugin.
	Add(ctx context.Context, pluginID, version string, opts CompatOpts) error
	// Remove removes an existing plugin.
	Remove(ctx context.Context, pluginID string) error
}

type PluginSource interface {
	PluginClass(ctx context.Context) Class
	PluginURIs(ctx context.Context) []string
	DefaultSignature(ctx context.Context) (Signature, bool)
}

type FileStore interface {
	// File retrieves a plugin file.
	File(ctx context.Context, pluginID, filename string) (*File, error)
}

type File struct {
	Content []byte
	ModTime time.Time
}

type CompatOpts struct {
	GrafanaVersion string
	OS             string
	Arch           string
}

type UpdateInfo struct {
	PluginZipURL string
}

type FS interface {
	fs.FS

	Base() string
	Files() []string
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
	backend.QueryDataHandler
	backend.CheckHealthHandler
	backend.StreamHandler
	backend.CallResourceHandler
	backend.CollectMetricsHandler
}

// BackendFactoryProvider provides a backend factory for a provided plugin.
type BackendFactoryProvider interface {
	BackendFactory(ctx context.Context, p *Plugin) backendplugin.PluginFactoryFunc
}

type RendererManager interface {
	// Renderer returns a renderer plugin.
	Renderer(ctx context.Context) *Plugin
}

type SecretsPluginManager interface {
	// SecretsManager returns a secretsmanager plugin
	SecretsManager(ctx context.Context) *Plugin
}

type StaticRouteResolver interface {
	Routes() []*StaticRoute
}

type ErrorResolver interface {
	PluginErrors() []*Error
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

// RoleRegistry handles the plugin RBAC roles and their assignments
type RoleRegistry interface {
	DeclarePluginRoles(ctx context.Context, ID, name string, registrations []RoleRegistration) error
}

// ClientMiddleware is an interface representing the ability to create a middleware
// that implements the Client interface.
type ClientMiddleware interface {
	// CreateClientMiddleware creates a new client middleware.
	CreateClientMiddleware(next Client) Client
}

// The ClientMiddlewareFunc type is an adapter to allow the use of ordinary
// functions as ClientMiddleware's. If f is a function with the appropriate
// signature, ClientMiddlewareFunc(f) is a ClientMiddleware that calls f.
type ClientMiddlewareFunc func(next Client) Client

// CreateClientMiddleware implements the ClientMiddleware interface.
func (fn ClientMiddlewareFunc) CreateClientMiddleware(next Client) Client {
	return fn(next)
}

type FeatureToggles interface {
	IsEnabled(flag string) bool
}

type SignatureCalculator interface {
	Calculate(ctx context.Context, src PluginSource, plugin FoundPlugin) (Signature, error)
}

type KeyStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key string, value string) error
	Del(ctx context.Context, key string) error
	ListKeys(ctx context.Context) ([]string, error)
	GetLastUpdated(ctx context.Context) time.Time
	SetLastUpdated(ctx context.Context)
}
