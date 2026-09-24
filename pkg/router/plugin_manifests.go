package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

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
	url      string
	client   *http.Client
	patterns []*regexp.Regexp
	deps     PluginDependencies
	authn    authn.TokenAuthenticator

	cooldown *cooldown

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]

	connectionsMu sync.Mutex
	connections   map[string]*grpc.ClientConn
	closed        bool
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
	// Same rationale as newAggregateTarget's check: url.Parse alone accepts
	// empty/relative values without error, which would otherwise build a
	// target that polls a URL it can never reach and only ever surfaces as a
	// recurring background WARN.
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("router: plugins_url must be absolute (scheme and host required): url=%q", rawURL)
	}

	t := &pluginManifestsTarget{
		deps:     deps,
		url:      rawURL,
		client:   client,
		patterns: patterns,
		authn:    authn,
		cooldown: newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	empty := []Backend{}
	t.snapshot.Store(&empty)
	emptyKeys := map[string]struct{}{}
	t.lastKeys.Store(&emptyKeys)
	return t, nil
}

// Backends returns the current polled-and-filtered backend snapshot. Safe
// to call from any goroutine.
func (t *pluginManifestsTarget) Backends() []Backend {
	return *t.snapshot.Load()
}

// run polls until ctx is done, paced entirely by t.cooldown -- identical
// shape to aggregateTarget.run; see that method's doc for why there is
// deliberately only one timing source.
func (t *pluginManifestsTarget) run(ctx context.Context, dirty chan<- struct{}) {
	defer t.closeConnections()
	timer := time.NewTimer(0) // fire immediately; don't wait an interval for the first attempt
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			t.poll(ctx, dirty)
			timer.Reset(t.cooldown.Until(time.Now()))
		}
	}
}

// poll performs one fetch-and-decode attempt and records its outcome on the
// cooldown, which schedules the next attempt. No pacing check of its own --
// run()'s timer is the only gate.
func (t *pluginManifestsTarget) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()

	deployment, err := fetchPluginManifests(ctx, t.client, t.url)
	if err != nil {
		t.cooldown.OnFailure(now)
		slog.Warn("router: plugin manifests poll failed, backing off", "url", t.url, "err", err)
		return
	}
	t.cooldown.OnSuccess(now)

	backends := make([]Backend, 0, len(deployment.Plugins))
	keys := make(map[string]struct{}, len(deployment.Plugins))
	for _, entry := range deployment.Plugins {
		if entry.Definition.Manifest == nil {
			continue
		}
		group := apiGroupFromManifestData(*entry.Definition.Manifest)
		if !matchesAnyPattern(group.Name, t.patterns) {
			continue
		}

		clients := func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error) {
			return t.pluginClients(entry.Host)
		}

		// Remove any dependencies that may try to load settings
		// After the manifest CRUD works, we can explore getting these wired properly
		deps := t.deps
		deps.PluginClient = nil
		deps.ContextProvider = nil
		deps.PluginSettings = nil
		deps.DualWrite = nil
		deps.AccessControl = pluginManifestAccessControl{}

		backend, err := NewPluginBackend(entry.Definition, clients, deps)

		if err != nil {
			slog.Warn("router: skipping plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", err)
			continue
		}
		// The host is outside PluginDefinition, but changing it must reload the backend.
		key, keyErr := pluginDeploymentKey(entry)
		if keyErr != nil {
			slog.Warn("router: skipping unfingerprintable plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", keyErr)
			continue
		}
		deploymentBackend := &pluginDeploymentBackend{Backend: backend, key: key, authn: t.authn}
		backends = append(backends, deploymentBackend)
		keys[deploymentBackend.Key()] = struct{}{}
	}

	t.snapshot.Store(&backends)

	lastKeys := *t.lastKeys.Load()
	if !sameKeySet(lastKeys, keys) {
		t.lastKeys.Store(&keys)
		select {
		case dirty <- struct{}{}:
		default: // already pending; coalesce
		}
	}
}

func (t *pluginManifestsTarget) pluginClients(host string) (plugins.Client, v3.ClientV3, error) {
	if host == "" {
		return nil, nil, nil // no client exists
	}

	t.connectionsMu.Lock()
	defer t.connectionsMu.Unlock()
	if t.closed {
		return nil, nil, fmt.Errorf("router: plugin manifests target is closed")
	}
	conn := t.connections[host]
	if conn == nil {
		// Plugin deployments expose plaintext gRPC on the internal cluster network.
		var err error
		conn, err = grpc.NewClient(host, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, nil, fmt.Errorf("router: creating plugin client for %q: %w", host, err)
		}
		if t.connections == nil {
			t.connections = make(map[string]*grpc.ClientConn)
		}
		t.connections[host] = conn
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
		}, nil
}

func (t *pluginManifestsTarget) closeConnections() {
	t.connectionsMu.Lock()
	defer t.connectionsMu.Unlock()
	t.closed = true
	for _, conn := range t.connections {
		_ = conn.Close()
	}
	t.connections = nil
}

// fetchPluginManifests fetches and decodes the plugin-manifests operator's
// GET /plugins response into definition.PluginDeployments -- the
// {"key","plugins":[{"definition":{"jsonData","manifest"},"host"}]} envelope
// that type describes, confirmed against a live operator instance. Unlike
// the k8s-style APIGroupList discoverGroups fetches for the aggregate
// targets, this is a bespoke, cloud-router-specific format.
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

// Standard plugin, but with OBO authentication and custom key
type pluginDeploymentBackend struct {
	Backend
	key   string
	authn authn.TokenAuthenticator
}

func (b *pluginDeploymentBackend) Key() string { return b.key }

func (b *pluginDeploymentBackend) Load(ctx context.Context) (http.Handler, error) {
	if b.authn == nil {
		return nil, fmt.Errorf("router: plugin deployment requires a token authenticator")
	}

	handler, err := b.Backend.Load(ctx)
	if err != nil {
		return nil, err
	}

	return &authenticatingWrapper{
		Handler: handler,
		authn:   b.authn,
	}, nil
}

type authenticatingWrapper struct {
	http.Handler
	authn authn.TokenAuthenticator
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
