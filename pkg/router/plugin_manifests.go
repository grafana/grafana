package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	backendgrpcplugin "github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// pluginManifestsTarget discovers remote plugin deployments and builds their API handlers.
type pluginManifestsTarget struct {
	*polledSource

	url      string
	client   *http.Client
	patterns []*regexp.Regexp
	deps     PluginDependencies
	authn    authn.TokenAuthenticator

	connectionsMu sync.Mutex
	connections   map[string]*pluginConnection
	closed        bool
}

// pluginConnection is a gRPC connection shared by the handlers built for one
// plugin host. It is closed when the last of them is destroyed.
type pluginConnection struct {
	conn *grpc.ClientConn
	refs int
}

func newPluginManifestsTarget(
	rawURL string,
	patterns []*regexp.Regexp,
	client *http.Client,
	deps PluginDependencies,
	authn authn.TokenAuthenticator,
) (*pluginManifestsTarget, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("router: parsing plugins_url %q: %w", rawURL, err)
	}
	// url.Parse accepts empty and relative URLs; see newAggregateTarget.
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("router: plugins_url must be absolute (scheme and host required): url=%q", rawURL)
	}

	t := &pluginManifestsTarget{
		deps:     deps,
		url:      rawURL,
		client:   client,
		patterns: patterns,
		authn:    authn,
	}
	t.polledSource = newPolledSource(sourcePluginsURL,
		newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff), t.discover)
	return t, nil
}

// run polls until ctx is done, then closes the target's connections.
func (t *pluginManifestsTarget) run(ctx context.Context, dirty chan<- struct{}) {
	defer t.closeConnections()
	t.polledSource.run(ctx, dirty)
}

// discover fetches the plugin deployments and builds a backend for each one
// that matches the target's patterns.
func (t *pluginManifestsTarget) discover(ctx context.Context) ([]Backend, error) {
	deployment, err := fetchPluginManifests(ctx, t.client, t.url)
	if err != nil {
		return nil, err
	}

	backends := make([]Backend, 0, len(deployment.Plugins))
	for _, entry := range deployment.Plugins {
		if entry.Definition.Manifest == nil {
			continue
		}
		group := apiGroupFromManifestData(*entry.Definition.Manifest)
		if !matchesAnyPattern(group.Name, t.patterns) {
			continue
		}

		// Remove any dependencies that may try to load settings
		// After the manifest CRUD works, we can explore getting these wired properly
		deps := t.deps
		deps.PluginClient = nil
		deps.ContextProvider = nil
		deps.PluginSettings = nil
		deps.DualWrite = nil
		deps.AccessControl = pluginManifestAccessControl{}

		backend, err := NewPluginBackend(entry.Definition, connectionClients, deps)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", err)
			continue
		}
		// The host is outside PluginDefinition, but changing it must reload the backend.
		key, keyErr := pluginDeploymentKey(entry)
		if keyErr != nil {
			logging.FromContext(ctx).Warn("router: skipping unfingerprintable plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", keyErr)
			continue
		}
		backends = append(backends, &pluginDeploymentBackend{Backend: backend, key: key, host: entry.Host, target: t, authn: t.authn})
	}
	return backends, nil
}

// acquireConnection returns the connection to host, and a release that the
// caller must call once it no longer uses it. An empty host has no backend
// client, so it returns no connection.
func (t *pluginManifestsTarget) acquireConnection(host string) (*grpc.ClientConn, func(), error) {
	if host == "" {
		return nil, func() {}, nil
	}

	t.connectionsMu.Lock()
	defer t.connectionsMu.Unlock()
	if t.closed {
		return nil, nil, fmt.Errorf("router: plugin manifests target is closed")
	}
	c := t.connections[host]
	if c == nil {
		// Plugin deployments expose plaintext gRPC on the internal cluster network.
		conn, err := grpc.NewClient(host, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, nil, fmt.Errorf("router: creating plugin client for %q: %w", host, err)
		}
		if t.connections == nil {
			t.connections = make(map[string]*pluginConnection)
		}
		c = &pluginConnection{conn: conn}
		t.connections[host] = c
	}
	c.refs++
	var once sync.Once
	return c.conn, func() { once.Do(func() { t.releaseConnection(host, c) }) }, nil
}

func (t *pluginManifestsTarget) releaseConnection(host string, c *pluginConnection) {
	t.connectionsMu.Lock()
	defer t.connectionsMu.Unlock()
	c.refs--
	if c.refs > 0 || t.connections[host] != c {
		return
	}
	delete(t.connections, host)
	_ = c.conn.Close()
}

// pluginClients returns the plugin clients over conn; nil clients for a nil conn.
func pluginClients(conn *grpc.ClientConn) (plugins.Client, v3.ClientV3) {
	if conn == nil {
		return nil, nil // no client exists
	}
	// NOTE: ClientV2 is missing ALL the middleware...
	return &backendgrpcplugin.ClientV2{
			DiagnosticsClient: pluginv2.NewDiagnosticsClient(conn),
			ResourceClient:    pluginv2.NewResourceClient(conn),
			DataClient:        pluginv2.NewDataClient(conn),
			StreamClient:      pluginv2.NewStreamClient(conn),
			AdmissionClient:   pluginv2.NewAdmissionControlClient(conn),
			ConversionClient:  pluginv2.NewResourceConversionClient(conn),
		}, &grpcplugin.ClientV3{
			AdmissionServiceClient:  pluginv3.NewAdmissionServiceClient(conn),
			ConversionServiceClient: pluginv3.NewConversionServiceClient(conn),
			RouteServiceClient:      pluginv3.NewRouteServiceClient(conn),
		}
}

// closeConnections closes every connection when the target stops, including
// those still held by served handlers.
func (t *pluginManifestsTarget) closeConnections() {
	t.connectionsMu.Lock()
	defer t.connectionsMu.Unlock()
	t.closed = true
	for _, c := range t.connections {
		_ = c.conn.Close()
	}
	t.connections = nil
}

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
	if err := json.NewDecoder(resp.Body).Decode(deployment); err != nil {
		return nil, fmt.Errorf("router: decoding plugin manifests from %s: %w", rawURL, err)
	}
	return deployment, nil
}

func pluginDeploymentKey(entry definition.PluginDeployment) (string, error) {
	body, err := json.Marshal(entry)
	if err != nil {
		return "", fmt.Errorf("router: fingerprinting plugin manifest entry %q: %w", entry.Definition.JSONData.ID, err)
	}
	sum := sha256.Sum256(body)
	return "managed:" + entry.Definition.JSONData.ID + ":" + hex.EncodeToString(sum[:])[:16], nil
}

// Standard plugin, but with OBO authentication, a custom key, and clients
// for the plugin's remote host.
type pluginDeploymentBackend struct {
	Backend
	key    string
	host   string
	target *pluginManifestsTarget
	authn  authn.TokenAuthenticator
}

func (b *pluginDeploymentBackend) Key() string { return b.key }

// Source implements [Backend]. It overrides the embedded PluginBackend's.
func (b *pluginDeploymentBackend) Source() string { return sourcePluginsURL }

// Load builds the plugin's handler over a connection to its host, held until
// the handler is destroyed.
func (b *pluginDeploymentBackend) Load(ctx context.Context) (http.Handler, error) {
	if b.authn == nil {
		return nil, fmt.Errorf("router: plugin deployment requires a token authenticator")
	}

	release := func() {}
	if b.target != nil {
		conn, releaseConn, err := b.target.acquireConnection(b.host)
		if err != nil {
			return nil, err
		}
		ctx, release = withPluginConnection(ctx, conn), releaseConn
	}
	handler, err := b.Backend.Load(ctx)
	if err != nil {
		release()
		return nil, err
	}

	return &authenticatingWrapper{
		Handler: handler,
		authn:   b.authn,
		release: release,
	}, nil
}

type pluginConnectionKey struct{}

// withPluginConnection hands the connection that pluginDeploymentBackend.Load
// holds to the plugin's client provider, connectionClients, which the
// PluginBackend calls from its own Load.
func withPluginConnection(ctx context.Context, conn *grpc.ClientConn) context.Context {
	return context.WithValue(ctx, pluginConnectionKey{}, conn)
}

// connectionClients is a [PluginClientProvider] for the connection in ctx.
func connectionClients(ctx context.Context, _ string) (plugins.Client, v3.ClientV3, error) {
	conn, _ := ctx.Value(pluginConnectionKey{}).(*grpc.ClientConn)
	clientV2, clientV3 := pluginClients(conn)
	return clientV2, clientV3, nil
}

type authenticatingWrapper struct {
	http.Handler
	authn   authn.TokenAuthenticator
	release func()
}

// Destroy implements [destroyer]: it destroys the plugin's handler, then
// releases its connection.
func (a *authenticatingWrapper) Destroy() {
	if d, ok := a.Handler.(destroyer); ok {
		d.Destroy()
	}
	if a.release != nil {
		a.release()
	}
}

func (a *authenticatingWrapper) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	info := a.authenticate(w, req)
	if info == nil {
		return
	}
	ctx := identity.WithRequester(req.Context(), info)
	a.Handler.ServeHTTP(w, req.WithContext(ctx))
}

func (a *authenticatingWrapper) authenticate(w http.ResponseWriter, req *http.Request) identity.Requester {
	ctx, span := otel.Tracer("github.com/grafana/grafana/pkg/router").Start(routerTraceContext(req), "router.plugin.authenticate")
	defer span.End()

	token := req.Header.Get("X-Access-Token")
	if token == "" {
		span.SetAttributes(semconv.ErrorTypeKey.String("missing_token"))
		span.SetStatus(codes.Error, "")
		_ = errhttp.Write(ctx, apierrors.NewUnauthorized("missing access token header"), w)
		return nil
	}

	info, err := a.authn.AuthenticateToken(ctx, token)
	if err != nil {
		errorType := "authentication_failure"
		if apierrors.IsUnauthorized(err) {
			errorType = "invalid_token"
		}
		span.SetAttributes(semconv.ErrorTypeKey.String(errorType))
		span.SetStatus(codes.Error, "")
		_ = errhttp.Write(ctx, err, w)
		return nil
	}

	return info
}
