package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	authn "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type fakeTokenExchanger struct {
	token  string
	gotReq *authn.TokenExchangeRequest
}

func (f *fakeTokenExchanger) Exchange(_ context.Context, req authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	f.gotReq = &req
	return &authn.TokenExchangeResponse{Token: f.token}, nil
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// The router authenticates an authlib access token from X-Access-Token, so the
// resolver's transport must send the exchanged token there.
func TestManifestResolver_AuthUsesAccessTokenHeader(t *testing.T) {
	exchanger := &fakeTokenExchanger{token: "exchanged-token"}

	var authorization, accessToken string
	base := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		authorization = r.Header.Get("Authorization")
		accessToken = r.Header.Get("X-Access-Token")
		rr := httptest.NewRecorder()
		rr.WriteHeader(http.StatusOK)
		return rr.Result(), nil
	})

	req, _ := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://example.org", nil)
	resp, err := manifestAuthWrapper(exchanger, "grafana")(base).RoundTrip(req)
	require.NoError(t, err)
	_ = resp.Body.Close()

	require.Equal(t, "Bearer exchanged-token", accessToken)
	require.Empty(t, authorization)
	require.NotNil(t, exchanger.gotReq)
	require.Equal(t, []string{"grafana"}, exchanger.gotReq.Audiences)
	require.Equal(t, clientauth.WildcardNamespace, exchanger.gotReq.Namespace)
}

// testAppManifestObj builds an unstructured AppManifest (v1alpha2) with one
// version declaring a single kind and the given search fields.
func testAppManifestObj(name, appName, group, kind string, searchFields ...string) *unstructured.Unstructured {
	sfs := make([]interface{}, 0, len(searchFields))
	for _, f := range searchFields {
		sfs = append(sfs, map[string]interface{}{"name": f, "type": "string"})
	}
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]interface{}{"name": name},
		"spec": map[string]interface{}{
			"appName": appName,
			"group":   group,
			"versions": []interface{}{
				map[string]interface{}{
					"name":   "v1",
					"served": true,
					"kinds": []interface{}{
						map[string]interface{}{
							"kind":         kind,
							"plural":       strings.ToLower(kind) + "s",
							"searchFields": sfs,
						},
					},
				},
			},
		},
	}}
}

// widgetsManifest is the router's document for widgets.test, named by its group.
func widgetsManifest(searchFields ...string) *unstructured.Unstructured {
	return testAppManifestObj("widgets.test", "widgets", "widgets.test", "Widget", searchFields...)
}

// fakeRouter serves /apis/discovery/v1alpha2/manifests/{group} the way the
// router does: the document with an ETag, a 304 when If-None-Match matches it,
// and a 404 for a group it has no manifest for.
type fakeRouter struct {
	t   *testing.T
	srv *httptest.Server

	mu       sync.Mutex
	docs     map[string][]byte
	requests map[string]int
	fail     bool
	release  chan struct{} // when set, requests wait for it to close
}

func newFakeRouter(t *testing.T, docs ...*unstructured.Unstructured) *fakeRouter {
	t.Helper()
	f := &fakeRouter{t: t, docs: map[string][]byte{}, requests: map[string]int{}}
	for _, d := range docs {
		f.set(d)
	}
	f.srv = httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeRouter) serve(w http.ResponseWriter, req *http.Request) {
	group, ok := strings.CutPrefix(req.URL.Path, routerManifestsPath)
	if !ok {
		http.NotFound(w, req)
		return
	}
	f.mu.Lock()
	f.requests[group]++
	release, fail, body := f.release, f.fail, f.docs[group]
	f.mu.Unlock()

	if release != nil {
		<-release
	}
	if fail {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	if body == nil {
		http.NotFound(w, req)
		return
	}
	sum := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(sum[:8]) + `"`
	w.Header().Set("ETag", etag)
	if req.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

// set publishes obj under its spec.group, as the router names it.
func (f *fakeRouter) set(obj *unstructured.Unstructured) {
	f.t.Helper()
	group, _, _ := unstructured.NestedString(obj.Object, "spec", "group")
	f.setRaw(group, obj)
}

func (f *fakeRouter) setRaw(group string, obj *unstructured.Unstructured) {
	f.t.Helper()
	body, err := obj.MarshalJSON()
	require.NoError(f.t, err)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.docs[group] = body
}

func (f *fakeRouter) remove(group string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.docs, group)
}

func (f *fakeRouter) setFail(fail bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.fail = fail
}

func (f *fakeRouter) block() chan struct{} {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.release = make(chan struct{})
	return f.release
}

func (f *fakeRouter) count(group string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.requests[group]
}

func (f *fakeRouter) fetcher() manifestFetcher {
	return &httpManifestFetcher{client: f.srv.Client(), baseURL: f.srv.URL}
}

// fakeClock is read by fetches running on other goroutines, so it is locked.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

// resolverHarness is a resolver against a fake router on a fake clock, with
// background revalidation run synchronously and every published set recorded.
type resolverHarness struct {
	*ManifestResolver
	router *fakeRouter
	clock  *fakeClock

	mu      sync.Mutex
	applied [][]*app.ManifestData
	failing int // apply calls left that fail
}

func (h *resolverHarness) applies() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.applied)
}

func (h *resolverHarness) lastApplied() []*app.ManifestData {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.applied[len(h.applied)-1]
}

func testResolver(t *testing.T, builtin []*app.ManifestData, docs ...*unstructured.Unstructured) *resolverHarness {
	t.Helper()
	h := &resolverHarness{
		router: newFakeRouter(t, docs...),
		clock:  &fakeClock{now: time.Unix(1_700_000_000, 0)},
	}
	h.ManifestResolver = newManifestResolver(h.router.fetcher(), builtin, func(m []*app.ManifestData) error {
		h.mu.Lock()
		defer h.mu.Unlock()
		if h.failing > 0 {
			h.failing--
			return errors.New("rejected")
		}
		h.applied = append(h.applied, m)
		return nil
	}, nil)
	h.now = h.clock.Now
	h.background = func(f func()) { f() }
	return h
}

var widgetsKey = NewLowerGroupResource("widgets.test", "widgets")

func TestManifestResolver_UnknownGroupWaitsForFetch(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))

	r.Ensure(t.Context(), widgetsKey)

	require.Equal(t, 1, r.router.count("widgets.test"))
	require.Equal(t, 1, r.applies())
	require.Len(t, r.Manifests(), 1)
	require.Equal(t, "widgets.test", r.Manifests()[0].Group)
}

func TestManifestResolver_FetchesOnlyTheRequestedGroup(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"),
		testAppManifestObj("gadgets.test", "gadgets", "gadgets.test", "Gadget", "title"))

	r.Ensure(t.Context(), widgetsKey)

	require.Equal(t, 1, r.router.count("widgets.test"))
	require.Zero(t, r.router.count("gadgets.test"))
	require.Len(t, r.Manifests(), 1)
}

func TestManifestResolver_KnownGroupDoesNotFetch(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.Ensure(t.Context(), widgetsKey)

	// Another resource of the same group is covered by the same manifest.
	r.clock.Advance(r.maxAge - time.Second)
	r.Ensure(t.Context(), NewLowerGroupResource("widgets.test", "sprockets"))
	require.Equal(t, 1, r.router.count("widgets.test"))
}

func TestManifestResolver_StaleGroupRevalidates(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.Ensure(t.Context(), widgetsKey)

	// Unchanged: the router answers 304 and nothing is published.
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))
	require.Equal(t, 1, r.applies())

	// Changed: the new manifest is published.
	r.router.set(widgetsManifest("title", "body"))
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 3, r.router.count("widgets.test"))
	require.Equal(t, 2, r.applies())
}

func TestManifestResolver_StaleGroupDoesNotWait(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.Ensure(t.Context(), widgetsKey)

	var started sync.WaitGroup
	started.Add(1)
	r.background = func(f func()) {
		started.Done()
		go f()
	}
	release := r.router.block()
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	started.Wait()
	close(release)
}

func TestManifestResolver_GroupDroppedByRouter(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.Ensure(t.Context(), widgetsKey)
	require.Len(t, r.Manifests(), 1)

	r.router.remove("widgets.test")
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	require.Empty(t, r.Manifests())
	require.Equal(t, 2, r.applies())
	require.Empty(t, r.lastApplied())
}

func TestManifestResolver_RemembersMisses(t *testing.T) {
	r := testResolver(t, nil)

	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 1, r.router.count("widgets.test"))
	require.Zero(t, r.applies())

	r.clock.Advance(r.missTTL - time.Second)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 1, r.router.count("widgets.test"))

	// Once the miss expires the group is asked about again, and found.
	r.router.set(widgetsManifest("title"))
	r.clock.Advance(time.Second)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))
	require.Len(t, r.Manifests(), 1)
}

func TestManifestResolver_BuiltinGroupFetchesInBackground(t *testing.T) {
	builtin, err := ManifestFromUnstructured(widgetsManifest("builtin"))
	require.NoError(t, err)
	r := testResolver(t, []*app.ManifestData{builtin}, widgetsManifest("live"))

	var backgrounded bool
	r.background = func(f func()) {
		backgrounded = true
		f()
	}
	r.Ensure(t.Context(), widgetsKey)
	require.True(t, backgrounded)
	require.Equal(t, 1, r.router.count("widgets.test"))
	require.Equal(t, 1, r.applies())

	// A builtin group the router has no manifest for keeps the builtin one and
	// is not asked about again until maxAge.
	r.router.remove("widgets.test")
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))
	r.clock.Advance(r.missTTL)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))
}

func TestManifestResolver_FailureKeepsManifestAndWaitsBeforeRetry(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.Ensure(t.Context(), widgetsKey)

	r.router.setFail(true)
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))
	require.Len(t, r.Manifests(), 1)
	require.Equal(t, 1, r.applies())

	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))

	r.router.setFail(false)
	r.clock.Advance(r.retryInterval)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 3, r.router.count("widgets.test"))
}

func TestManifestResolver_FailureForUnknownGroupIsNotAMiss(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.router.setFail(true)

	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 1, r.router.count("widgets.test"))
	require.Empty(t, r.Manifests())

	r.router.setFail(false)
	r.clock.Advance(r.retryInterval)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, 2, r.router.count("widgets.test"))
	require.Len(t, r.Manifests(), 1)
}

func TestManifestResolver_ConcurrentMissesShareOneFetch(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	release := r.router.block()

	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() { r.Ensure(t.Context(), widgetsKey) })
	}
	require.Eventually(t, func() bool { return r.router.count("widgets.test") == 1 }, time.Second, time.Millisecond)
	close(release)
	wg.Wait()
	require.Equal(t, 1, r.router.count("widgets.test"))
	require.Equal(t, 1, r.applies())
}

func TestManifestResolver_EnsureReturnsWhenCallerGivesUp(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	release := r.router.block()
	defer close(release)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	r.Ensure(ctx, widgetsKey)
}

func TestManifestResolver_RepublishesAfterApplyError(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.failing = 1

	r.Ensure(t.Context(), widgetsKey)
	require.Zero(t, r.applies())

	// The next fetch publishes again, even for a group with no manifest.
	r.Ensure(t.Context(), NewLowerGroupResource("gadgets.test", "gadgets"))
	require.Equal(t, 1, r.applies())
	require.Len(t, r.lastApplied(), 1)
}

func TestManifestResolver_ConversionFailureKeepsPreviousManifest(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.Ensure(t.Context(), widgetsKey)

	r.router.setRaw("widgets.test", &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]interface{}{"name": "widgets.test"},
	}})
	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)

	require.Equal(t, 2, r.router.count("widgets.test"))
	require.Equal(t, 1, r.applies())
	require.Len(t, r.Manifests(), 1)
}

func TestManifestResolver_RejectsManifestForAnotherGroup(t *testing.T) {
	r := testResolver(t, nil)
	r.router.setRaw("widgets.test", testAppManifestObj("widgets.test", "gadgets", "gadgets.test", "Gadget", "title"))

	r.Ensure(t.Context(), widgetsKey)
	require.Zero(t, r.applies())
	require.Empty(t, r.Manifests())
}

func TestManifestResolver_RecordsMetrics(t *testing.T) {
	r := testResolver(t, nil, widgetsManifest("title"))
	r.metrics = newManifestResolverMetrics(prometheus.NewPedanticRegistry())

	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.fetches.WithLabelValues("miss", "found")))
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.reloads))
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.manifests))
	require.Positive(t, testutil.ToFloat64(r.metrics.lastSuccess))

	r.clock.Advance(r.maxAge)
	r.Ensure(t.Context(), widgetsKey)
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.fetches.WithLabelValues("revalidate", "not_modified")))
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.reloads))

	r.Ensure(t.Context(), NewLowerGroupResource("gadgets.test", "gadgets"))
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.fetches.WithLabelValues("miss", "not_found")))

	r.router.setFail(true)
	r.Ensure(t.Context(), NewLowerGroupResource("sprockets.test", "sprockets"))
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.fetches.WithLabelValues("miss", "error")))
	require.Equal(t, float64(1), testutil.ToFloat64(r.metrics.reloads))
}

func TestManifestFromUnstructured_PreservesEmbeddingVersions(t *testing.T) {
	obj := testAppManifestObj("m-foos", "foos", "foo.grafana.app", "Foo")
	spec := obj.Object["spec"].(map[string]interface{})
	spec["embed"] = map[string]interface{}{"foos": map[string]interface{}{"reembedVersion": int64(3)}}
	spec["versions"] = []interface{}{
		map[string]interface{}{
			"name": "v2", "served": true,
			"kinds": []interface{}{map[string]interface{}{
				"kind": "Foo", "embed": map[string]interface{}{"fields": []interface{}{
					map[string]interface{}{"name": "title", "path": "spec.title"},
					map[string]interface{}{"name": "description", "path": "spec.description"},
				}},
			}},
		},
		map[string]interface{}{
			"name": "v1", "served": false,
			"kinds": []interface{}{map[string]interface{}{
				"kind": "Foo", "embed": map[string]interface{}{"fields": []interface{}{
					map[string]interface{}{"name": "title", "path": "spec.oldTitle"},
				}},
			}},
		},
	}
	before := obj.DeepCopy()

	data, err := ManifestFromUnstructured(obj)
	require.NoError(t, err)
	require.Equal(t, map[string]app.ManifestResourceEmbed{"foos": {ReembedVersion: 3}}, data.Embed)
	require.Len(t, data.Versions, 2)
	require.Equal(t, "v2", data.Versions[0].Name)
	require.Equal(t, []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}, {Name: "description", Path: "spec.description"}}, data.Versions[0].Kinds[0].Embed.Fields)
	require.Equal(t, "v1", data.Versions[1].Name)
	require.False(t, data.Versions[1].Served)
	require.Equal(t, []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.oldTitle"}}, data.Versions[1].Kinds[0].Embed.Fields)
	require.Equal(t, before, obj)
}

func TestNewManifestResolverConfig(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		sec, err := cfg.Raw.NewSection("grpc_client_authentication")
		require.NoError(t, err)
		_, err = sec.NewKey("token", "tok")
		require.NoError(t, err)
		_, err = sec.NewKey("token_exchange_url", "http://exchange")
		require.NoError(t, err)
		return cfg
	}

	t.Run("nil when address missing", func(t *testing.T) {
		require.Nil(t, NewManifestResolverConfig(newCfg()))
	})

	t.Run("nil config returns nil", func(t *testing.T) {
		require.Nil(t, NewManifestResolverConfig(nil))
	})

	t.Run("old apiserver address is not read", func(t *testing.T) {
		cfg := newCfg()
		sec, err := cfg.Raw.NewSection("unified_storage")
		require.NoError(t, err)
		_, err = sec.NewKey("manifest_api_server_address", "https://apiserver")
		require.NoError(t, err)
		require.Nil(t, NewManifestResolverConfig(cfg))
	})

	t.Run("configured when all set", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestRouterAddress = "https://router/"
		rc := NewManifestResolverConfig(cfg)
		require.NotNil(t, rc)
		require.Equal(t, "https://router", rc.RouterURL)
		require.Equal(t, "grafana", rc.Audience)
		require.Equal(t, "tok", rc.Token)
		require.Equal(t, "http://exchange", rc.TokenExchangeURL)
	})

	t.Run("audience override", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestRouterAddress = "https://router"
		cfg.ManifestRouterAudience = "router.grafana.app"
		require.Equal(t, "router.grafana.app", NewManifestResolverConfig(cfg).Audience)
	})

	t.Run("insecure TLS ignored outside development", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestRouterAddress = "https://router"
		cfg.ManifestRouterAllowInsecureTLS = true
		cfg.Env = setting.Prod
		rc := NewManifestResolverConfig(cfg)
		require.NotNil(t, rc)
		require.False(t, rc.AllowInsecure)
	})
}
