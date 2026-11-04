package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	backendgrpcplugin "github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/baasbridge" //nolint:staticcheck // deprecated shim, used until HTTP operators move to gRPC
)

// pluginManifestsTarget discovers remote plugin deployments and builds their API handlers.
type pluginManifestsTarget struct {
	polledSource
	*pluginConnections

	keyPrefix string // prefixes every backend Key, so sources never share a key
	url       string
	client    *http.Client
	patterns  []*regexp.Regexp
	deps      PluginDependencies
}

// pluginConnections holds the connections to the plugin deployments of one
// source, and builds their clients.
type pluginConnections struct {
	grpcConfig pluginGRPCConfig
	// httpTransport serves the baasbridge clients of deployments whose host is
	// an HTTP URL.
	httpTransport http.RoundTripper

	// requestDuration records every gRPC call to a plugin deployment, by
	// plugin, method and status code.
	requestDuration *prometheus.HistogramVec
	// requestRetries counts the retries of unary calls, by plugin and method.
	requestRetries *prometheus.CounterVec

	connectionsMu sync.Mutex
	connections   map[pluginConnectionKey]*pluginConnection
	closed        bool
}

func newPluginConnections(source string, grpcConfig pluginGRPCConfig, reg prometheus.Registerer) *pluginConnections {
	return &pluginConnections{
		grpcConfig:      grpcConfig,
		httpTransport:   baasbridge.NewTransport(grpcConfig.TLS, backendResponseHeaderTimeout), //nolint:staticcheck
		requestDuration: newPluginGRPCRequestDuration(reg, source),
		requestRetries:  newPluginGRPCRequestRetries(reg, source),
	}
}

// pluginConnection is a connection to a plugin deployment, and the number of
// loaded handlers that use it. It closes when the last one is destroyed.
type pluginConnection struct {
	conn *grpc.ClientConn
	refs int
}

// pluginConnectionKey identifies a connection by plugin as well as host,
// because each connection records its calls under one plugin ID.
type pluginConnectionKey struct {
	host     string
	pluginID string
}

func newPluginManifestsTarget(
	source string,
	rawURL string,
	patterns []*regexp.Regexp,
	client *http.Client,
	grpcConfig pluginGRPCConfig,
	deps PluginDependencies,
) (*pluginManifestsTarget, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("router: parsing %s %q: %w", source, rawURL, err)
	}
	// url.Parse accepts empty and relative URLs; see newAggregateTarget.
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("router: %s must be absolute (scheme and host required): url=%q", source, rawURL)
	}

	// Managed plugins have no local plugin settings for the legacy app-access
	// check, so it always grants access (pluginManifestAccessControl).
	deps.AccessControl = pluginManifestAccessControl{}
	t := &pluginManifestsTarget{
		pluginConnections: newPluginConnections(source, grpcConfig, deps.MetricsRegister),
		keyPrefix:         source,
		deps:              deps,
		url:               rawURL,
		client:            client,
		patterns:          patterns,
	}
	t.polledSource = polledSource{
		source:   source,
		fetcher:  t,
		cooldown: newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	return t, nil
}

// validatePluginID checks an entry's plugin ID before any backend is built for
// it. Tokens the router sends a plugin name its ID as their audience, so the ID
// must have the shape of an app plugin ID, as local plugins must. Core APIs may
// have no ID, and so may bridge entries; their tokens name their API group instead.
func (t *pluginManifestsTarget) validatePluginID(id string) error {
	if id == "" {
		if t.source == sourceCore || t.source == sourceBridge {
			return nil
		}
		return errors.New("missing plugin ID")
	}
	if !isAppPluginID(id) {
		return fmt.Errorf("invalid app plugin ID %q", id)
	}
	return nil
}

// fetch implements [sourceFetcher]: one fetch of the deployments, each
// manifest a backend.
func (t *pluginManifestsTarget) fetch(ctx context.Context) ([]Backend, int, error) {
	deployment, err := fetchPluginManifests(ctx, t.client, t.url)
	if err != nil {
		return nil, 0, err
	}

	backends := make([]Backend, 0, len(deployment.Plugins))
	skipped := 0
	for _, entry := range deployment.Plugins {
		if err := t.validatePluginID(entry.Definition.JSONData.ID); err != nil {
			if len(entry.Definition.Manifests) > 0 {
				logging.FromContext(ctx).Warn("router: skipping plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", err)
				skipped++
			}
			continue
		}
		for _, manifest := range entry.Definition.Manifests {
			if manifest == nil || !matchesAnyPattern(manifest.Group, t.patterns) {
				continue
			}

			// A connection records its calls under one plugin_id. A core_url
			// entry may have no plugin ID, so its connection is labeled by its
			// API group instead, which keeps core APIs on one host apart. The
			// backend's requests are recorded under the same ID.
			connectionID := entry.Definition.JSONData.ID
			if connectionID == "" {
				connectionID = manifest.Group
			}
			clients := func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error) {
				return t.pluginClients(entry.Host, connectionID, manifest)
			}

			backend, err := newPluginBackend(entry.Definition.JSONData.ID, manifest, clients, t.deps, nil)

			if err != nil {
				logging.FromContext(ctx).Warn("router: skipping plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", err)
				skipped++
				continue
			}

			backend.metricsID = connectionID
			backend.info = entry.Definition.JSONData.Info
			// Without a host, the deployment has no backend to call.
			backend.hasBackend = entry.Host != ""
			// An HTTP operator is reached through baasbridge, with no gRPC
			// connection to hold.
			if host := entry.Host; host != "" && !baasbridge.IsHTTPHost(host) { //nolint:staticcheck
				backend.acquire = func() (func(), error) { return t.acquireConnection(host, connectionID) }
			}

			// The host is outside PluginDefinition, but changing it must reload the backend.
			key, keyErr := pluginDeploymentKey(t.keyPrefix, entry, manifest)
			if keyErr != nil {
				logging.FromContext(ctx).Warn("router: skipping unfingerprintable plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", keyErr)
				skipped++
				continue
			}
			backend.key, backend.source = key, t.source
			backends = append(backends, backend)
		}
	}
	return backends, skipped, nil
}

// close implements [sourceCloser].
func (t *pluginManifestsTarget) close() {
	t.closeConnections()
}

// pluginClients returns the clients for a deployment's host. A host that is an
// http or https URL is an operator written for apiextensions-apiserver, which
// serves only the v3 calls, over HTTP; manifest declares its admission hooks.
func (p *pluginConnections) pluginClients(host, pluginID string, manifest *app.ManifestData) (plugins.Client, appclientv3.Client, error) {
	if host == "" {
		return nil, nil, nil // no client exists
	}
	p.connectionsMu.Lock()
	defer p.connectionsMu.Unlock()
	if p.closed {
		return nil, nil, fmt.Errorf("router: plugin connections are closed")
	}

	// Temporarily support the BaaS HTTP style operators
	if baasbridge.IsHTTPHost(host) { //nolint:staticcheck
		clientV3, err := baasbridge.NewClient(host, manifest, baasbridge.Options{ //nolint:staticcheck
			HTTPClient:       &http.Client{Transport: p.httpTransport},
			MaxResponseBytes: int64(p.grpcConfig.Message.MaxRecvSize),
			RouteCredentials: forwardRouteCredentials,
		})
		if err != nil {
			return nil, nil, err
		}
		return nil, clientV3, nil
	}

	c, err := p.connectionLocked(pluginConnectionKey{host: host, pluginID: pluginID})
	if err != nil {
		return nil, nil, err
	}
	conn := c.conn
	// Caller authentication is added by PluginBackend.Load.
	clientV3, err := grpcplugin.NewClientV3FromConn(conn, grpcplugin.ClientV3Options{})
	if err != nil {
		return nil, nil, err
	}
	// NOTE: ClientV2 is missing ALL the middleware...
	return &backendgrpcplugin.ClientV2{
		DiagnosticsClient: pluginv2.NewDiagnosticsClient(conn),
		ResourceClient:    pluginv2.NewResourceClient(conn),
		DataClient:        pluginv2.NewDataClient(conn),
		StreamClient:      pluginv2.NewStreamClient(conn),
		AdmissionClient:   pluginv2.NewAdmissionControlClient(conn),
		ConversionClient:  pluginv2.NewResourceConversionClient(conn),
	}, clientV3, nil
}

// forwardRouteCredentials sends an HTTP operator's route the caller's identity
// as apiextensions-apiserver's custom-route proxy does, with raw tokens: the ID
// token always, and the access token, a bearer credential the operator could
// replay, only when no declared check authorized the route, leaving the
// operator to authorize it.
func forwardRouteCredentials(ctx context.Context, header http.Header) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil
	}
	if token := requester.GetIDToken(); token != "" {
		header.Set("X-Grafana-Id", token)
	}
	if !baasbridge.DeclaredAccessChecked(ctx) { //nolint:staticcheck
		if token := requester.GetAccessToken(); token != "" {
			header.Set("X-Access-Token", token)
		}
	}
	return nil
}

// acquireConnection takes a reference to the connection for host and plugin,
// for a handler about to be loaded. The returned release drops it, when the
// handler is destroyed or fails to load, and the connection closes with its
// last reference. A handler from a superseded entry keeps its connection
// until it is destroyed, since the router may still serve it.
func (p *pluginConnections) acquireConnection(host, pluginID string) (func(), error) {
	key := pluginConnectionKey{host: host, pluginID: pluginID}
	p.connectionsMu.Lock()
	defer p.connectionsMu.Unlock()
	c, err := p.connectionLocked(key)
	if err != nil {
		return nil, err
	}
	c.refs++
	var once sync.Once
	return func() {
		once.Do(func() {
			p.connectionsMu.Lock()
			defer p.connectionsMu.Unlock()
			c.refs--
			// After closeConnections, every connection is already closed.
			if c.refs == 0 && !p.closed && p.connections[key] == c {
				_ = c.conn.Close()
				delete(p.connections, key)
			}
		})
	}, nil
}

// connectionLocked returns the connection for key, creating it if needed.
func (p *pluginConnections) connectionLocked(key pluginConnectionKey) (*pluginConnection, error) {
	if p.closed {
		return nil, fmt.Errorf("router: plugin connections are closed")
	}
	if c := p.connections[key]; c != nil {
		return c, nil
	}
	labels := prometheus.Labels{"plugin_id": key.pluginID}
	requestDuration := p.requestDuration.MustCurryWith(labels).(*prometheus.HistogramVec)
	requestRetries := p.requestRetries.MustCurryWith(labels)
	conn, err := grpc.NewClient(key.host, p.grpcConfig.dialOptions(requestDuration, requestRetries)...)
	if err != nil {
		return nil, fmt.Errorf("router: creating plugin client for %q: %w", key.host, err)
	}
	if p.connections == nil {
		p.connections = make(map[pluginConnectionKey]*pluginConnection)
	}
	c := &pluginConnection{conn: conn}
	p.connections[key] = c
	return c, nil
}

func (p *pluginConnections) closeConnections() {
	p.connectionsMu.Lock()
	defer p.connectionsMu.Unlock()
	p.closed = true
	for _, c := range p.connections {
		_ = c.conn.Close()
	}
	p.connections = nil
}

// maxPluginManifestsBytes bounds the plugin manifests response, which holds
// every deployment's manifest and schemas.
const maxPluginManifestsBytes = 32 << 20 // 32MB

// fetchPluginManifests fetches the plugin-manifests operator's GET /plugins
// response, decoded as definition.PluginDeployments.
func fetchPluginManifests(ctx context.Context, client *http.Client, rawURL string) (*definition.PluginDeployments, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("router: building plugin manifests request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("router: plugin manifests request to %s failed: %w", rawURL, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("router: plugin manifests request to %s returned status %d", rawURL, resp.StatusCode)
	}

	deployment := &definition.PluginDeployments{}
	if err := decodeLimitedJSON(resp.Body, maxPluginManifestsBytes, deployment); err != nil {
		return nil, fmt.Errorf("router: decoding plugin manifests from %s: %w", rawURL, err)
	}

	// Move any deprecated singular manifest properties to the multiple flavor
	// nolint:staticcheck
	for i := range deployment.Plugins {
		plugin := &deployment.Plugins[i]
		if plugin.Definition.Manifest == nil {
			continue // OK
		}
		// The plural entry is authoritative when both formats contain the same group.
		if !slices.ContainsFunc(plugin.Definition.Manifests, func(manifest *app.ManifestData) bool {
			return manifest != nil && manifest.Group == plugin.Definition.Manifest.Group
		}) {
			plugin.Definition.Manifests = append(plugin.Definition.Manifests, plugin.Definition.Manifest)
		}
		plugin.Definition.Manifest = nil
	}
	for _, plugin := range deployment.Plugins {
		for _, manifest := range plugin.Definition.Manifests {
			definition.MigrateDeprecatedRoutes(manifest)
		}
	}

	return deployment, nil
}

func pluginDeploymentKey(keyPrefix string, entry definition.PluginDeployment, manifest *app.ManifestData) (string, error) {
	body, err := pluginManifestKeyData(entry.Definition, manifest, entry.Host)
	if err != nil {
		return "", fmt.Errorf("router: fingerprinting plugin manifest entry %q: %w", entry.Definition.JSONData.ID, err)
	}
	sum := sha256.Sum256(body)
	return keyPrefix + ":" + entry.Definition.JSONData.ID + ":" + hex.EncodeToString(sum[:])[:16], nil
}
