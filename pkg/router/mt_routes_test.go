package router

import (
	"context"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

// fakeMTRouter serves the groups the multi-tenant router itself serves, for a
// stack's poll, and counts the requests that reach it by path.
type fakeMTRouter struct {
	*httptest.Server
	hits atomic.Int32
	// skipSTSeen is set when a discovery request carried the skip-stacks header.
	skipSTSeen atomic.Bool
	markerSeen atomic.Bool
	// accessToken is the X-Access-Token of the latest discovery request.
	accessToken atomic.Value
	// proxiedToken is the X-Access-Token of the latest proxied request.
	proxiedToken atomic.Value
}

func newFakeMTRouter(t *testing.T, groups ...string) *fakeMTRouter {
	t.Helper()
	f := &fakeMTRouter{}
	f.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.hits.Add(1)
		if r.Header.Get(routerOriginHeader) == originST {
			f.markerSeen.Store(true)
		}
		if r.URL.Path == apisPrefix {
			if r.Header.Get(routerOriginHeader) == originST {
				f.skipSTSeen.Store(true)
			}
			f.accessToken.Store(r.Header.Get("X-Access-Token"))
			serveLocalDiscovery(w, true, groups)
			return
		}
		f.proxiedToken.Store(r.Header.Get("X-Access-Token"))
		if strings.HasPrefix(r.URL.Path, openapiV3Prefix+"/apis/") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"openapi":"3.0.0","info":{"title":"mt","version":"v1"},"paths":{}}`))
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(f.Close)
	return f
}

func testMTTarget(t *testing.T, mt *fakeMTRouter) *aggregateTarget {
	t.Helper()
	target, err := newAggregateTarget(aggregateTargetConfig{Name: mtSourceName, URL: mt.URL}, mt.Client(), mt.Client().Transport)
	require.NoError(t, err)
	return target
}

// wakeLoader is an inner routes loader whose wake-ups a test controls.
type wakeLoader struct {
	backends []Backend
	wake     chan struct{}
}

func (l *wakeLoader) Load(context.Context) ([]Backend, error) { return l.backends, nil }
func (l *wakeLoader) Notify(context.Context) (<-chan struct{}, error) {
	return l.wake, nil
}

func TestMTRoutesLoad(t *testing.T) {
	mt := newFakeMTRouter(t, "mt.grafana.app", "local.grafana.app", "plugin.grafana.app")
	api := newFakeAPIServer(t, true, "local.grafana.app")
	inner := &wakeLoader{backends: []Backend{&fakeBackend{key: "plugin", group: testGroup("plugin.grafana.app")}}}
	target := testMTTarget(t, mt)
	local := newLocalGroups()
	routes := newMTRoutes(inner, target, local)
	target.poll(t.Context(), make(chan struct{}, 1))

	names := func() []string {
		backends, err := routes.Load(t.Context())
		require.NoError(t, err)
		var out []string
		for _, b := range backends {
			out = append(out, b.Group().Name)
		}
		return out
	}

	// Until the groups the embedded apiserver serves are known, a group might
	// really be local, so none of the router's are offered.
	require.Equal(t, []string{"plugin.grafana.app"}, names())

	require.NoError(t, local.load(t.Context(), api.Client(), api.URL))
	// A group served locally, or by an inner source, stays with that server.
	require.Equal(t, []string{"plugin.grafana.app", "mt.grafana.app"}, names())

	backends, _ := routes.Load(t.Context())
	require.Equal(t, aggregateSource(mtSourceName), backends[1].Source())
}

// A request that a stack already forwarded here is never sent on again, which
// stops a stack whose router address points at itself.
func TestMTRoutesRefuseMarkedRequests(t *testing.T) {
	mt := newFakeMTRouter(t, "mt.grafana.app")
	api := newFakeAPIServer(t, true)
	target := testMTTarget(t, mt)
	local := newLocalGroups()
	routes := newMTRoutes(&wakeLoader{}, target, local)
	target.poll(t.Context(), make(chan struct{}, 1))
	require.NoError(t, local.load(t.Context(), api.Client(), api.URL))
	backends, err := routes.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 1)
	handler, err := backends[0].Load(t.Context())
	require.NoError(t, err)

	serve := func(origin string) int {
		req := httptest.NewRequest(http.MethodGet, "/apis/mt.grafana.app/v1/namespaces/default/things", nil)
		if origin != "" {
			req.Header.Set(routerOriginHeader, origin)
		}
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{}))
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder.Code
	}
	before := mt.hits.Load()
	for _, origin := range []string{originST, originMT, "somebody-else"} {
		require.Equal(t, http.StatusNotFound, serve(origin), origin)
	}
	require.Equal(t, before, mt.hits.Load(), "a request that already crossed must not reach the router")
	require.Equal(t, http.StatusAccepted, serve(""))
	require.True(t, mt.markerSeen.Load(), "the stack marks what it forwards")
}

func TestMTRoutesNotify(t *testing.T) {
	mt := newFakeMTRouter(t, "mt.grafana.app")
	api := newFakeAPIServer(t, true)
	inner := &wakeLoader{wake: make(chan struct{}, 1)}
	target := testMTTarget(t, mt)
	local := newLocalGroups()
	routes := newMTRoutes(inner, target, local)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	wake, err := routes.Notify(ctx)
	require.NoError(t, err)
	next := func(what string) {
		t.Helper()
		select {
		case <-wake:
		case <-time.After(5 * time.Second):
			t.Fatalf("no wake-up for %s", what)
		}
	}

	next("the first poll of the router's groups")
	inner.wake <- struct{}{}
	next("an inner source")
	require.NoError(t, local.load(t.Context(), api.Client(), api.URL))
	next("the local groups becoming known")
}

func testMTConfig(address string) mtRoutesConfig {
	return mtRoutesConfig{Address: address, Exchanger: authnlib.NewStaticTokenExchanger("exchanged")}
}

// The stack polls as itself, with its access policy, and asks the router to
// skip stacks so the answer is the router's own groups.
func TestBuildMTRoutesPollsAsTheStack(t *testing.T) {
	mt := newFakeMTRouter(t, "mt.grafana.app")
	api := newFakeAPIServer(t, true)
	routes, err := buildMTRoutes(&wakeLoader{}, testMTConfig(mt.URL))
	require.NoError(t, err)
	routes.target.poll(t.Context(), make(chan struct{}, 1))
	require.NoError(t, routes.local.load(t.Context(), api.Client(), api.URL))

	require.True(t, mt.skipSTSeen.Load())
	require.Equal(t, "Bearer exchanged", mt.accessToken.Load())
	backends, err := routes.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 1)
	require.Equal(t, "mt.grafana.app", backends[0].Group().Name)
}

func TestBuildMTRoutesTLS(t *testing.T) {
	mt := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		serveLocalDiscovery(w, true, []string{"mt.grafana.app"})
	}))
	defer mt.Close()
	caFile := filepath.Join(t.TempDir(), "ca.pem")
	require.NoError(t, os.WriteFile(caFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: mt.Certificate().Raw}), 0o600))

	polled := func(t *testing.T, mutate func(*mtRoutesConfig)) int {
		t.Helper()
		cfg := testMTConfig(mt.URL)
		mutate(&cfg)
		routes, err := buildMTRoutes(&wakeLoader{}, cfg)
		require.NoError(t, err)
		routes.target.poll(t.Context(), make(chan struct{}, 1))
		return len(routes.target.Backends())
	}
	// An untrusted certificate discovers nothing without a CA, and works with
	// the CA, or when verification is skipped.
	require.Zero(t, polled(t, func(*mtRoutesConfig) {}))
	require.Equal(t, 1, polled(t, func(c *mtRoutesConfig) { c.CAFile = caFile }))
	require.Equal(t, 1, polled(t, func(c *mtRoutesConfig) { c.Insecure = true }))
}

func TestBuildMTRoutesValidation(t *testing.T) {
	for name, tc := range map[string]struct {
		mutate func(*mtRoutesConfig)
		want   string
	}{
		"relative address":  {func(c *mtRoutesConfig) { c.Address = "mt-router:3000" }, mtRouterAddressKey},
		"ca and insecure":   {func(c *mtRoutesConfig) { c.CAFile = "/ca.pem"; c.Insecure = true }, mtRouterCAFileKey},
		"missing ca file":   {func(c *mtRoutesConfig) { c.CAFile = "/does/not/exist.pem" }, "ca_file"},
		"missing exchanger": {func(c *mtRoutesConfig) { c.Exchanger = nil }, "grpc_client_authentication"},
	} {
		t.Run(name, func(t *testing.T) {
			cfg := testMTConfig("https://mt-router:3000")
			tc.mutate(&cfg)
			_, err := buildMTRoutes(&wakeLoader{}, cfg)
			require.ErrorContains(t, err, tc.want)
		})
	}
}

func TestNewMTRoutesFromConfig(t *testing.T) {
	inner := &wakeLoader{}
	set := func(cfg *setting.Cfg, section, key, value string) {
		cfg.Raw.Section(section).Key(key).SetValue(value)
	}
	configured := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.StackID = "1"
		set(cfg, cloudRouterSection, mtRouterAddressKey, "https://mt-router:3000")
		set(cfg, "grpc_client_authentication", "token", "policy-token")
		set(cfg, "grpc_client_authentication", "token_exchange_url", "https://auth.example.com/exchange")
		return cfg
	}

	t.Run("no address changes nothing", func(t *testing.T) {
		loader, err := newMTRoutesFromConfig(setting.NewCfg(), inner)
		require.NoError(t, err)
		require.Same(t, inner, loader)
	})
	t.Run("not a cloud stack changes nothing", func(t *testing.T) {
		cfg := configured()
		cfg.StackID = ""
		loader, err := newMTRoutesFromConfig(cfg, inner)
		require.NoError(t, err)
		require.Same(t, inner, loader)
	})
	t.Run("a configured stack adds the router's groups", func(t *testing.T) {
		loader, err := newMTRoutesFromConfig(configured(), inner)
		require.NoError(t, err)
		require.IsType(t, &mtRoutes{}, loader)
	})
	t.Run("the stack's access policy is required", func(t *testing.T) {
		cfg := configured()
		set(cfg, "grpc_client_authentication", "token", "")
		_, err := newMTRoutesFromConfig(cfg, inner)
		require.ErrorContains(t, err, "grpc_client_authentication")
	})
}

func TestRandomFractionIsInRange(t *testing.T) {
	seen := map[float64]struct{}{}
	for range 100 {
		f := randomFraction()
		require.GreaterOrEqual(t, f, 0.0)
		require.Less(t, f, 1.0)
		seen[f] = struct{}{}
	}
	require.Greater(t, len(seen), 1, "the value must vary")
}

// capturingExchanger records what the stack asks its token to be good for.
type capturingExchanger struct {
	requests []authnlib.TokenExchangeRequest
}

func (c *capturingExchanger) Exchange(_ context.Context, r authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	c.requests = append(c.requests, r)
	return &authnlib.TokenExchangeResponse{Token: "exchanged"}, nil
}

// The router does not check the audience, so the stack asks for a fixed one.
func TestBuildMTRoutesAsksForTheDiscoveryAudience(t *testing.T) {
	mt := newFakeMTRouter(t, "mt.grafana.app")
	exchanger := &capturingExchanger{}
	routes, err := buildMTRoutes(&wakeLoader{}, mtRoutesConfig{Address: mt.URL, Exchanger: exchanger})
	require.NoError(t, err)
	routes.target.poll(t.Context(), make(chan struct{}, 1))
	require.NotEmpty(t, exchanger.requests)
	require.Equal(t, []string{"mt-discovery"}, exchanger.requests[0].Audiences)
}
