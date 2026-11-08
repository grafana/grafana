package resources

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// playlistKind is an arbitrary identifier used only to exercise the supported-set plumbing
// in these tests; it need not be a real provisionable kind.
var (
	playlistKind     = schema.GroupKind{Group: "playlist.grafana.app", Kind: "Playlist"}
	playlistGVK      = schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v0alpha1", Kind: "Playlist"}
	dashboardTestGVK = schema.GroupVersionKind{Group: DashboardResource.Group, Version: "v1", Kind: DashboardKind.Kind}
)

func TestResourceClients_SupportedResources(t *testing.T) {
	t.Run("falls back to the static base set when none is configured", func(t *testing.T) {
		clients, err := NewClientFactory(nil).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, SupportedProvisioningResources, clients.SupportedResources())
	})

	t.Run("returns only the active configured resources", func(t *testing.T) {
		active := SupportedResource{GroupKind: DashboardKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)}
		disabled := SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilityDisabled)}

		clients, err := NewClientFactory(nil, active, disabled).Clients(context.Background(), "default")
		require.NoError(t, err)

		// Disabled resources are not acted on, so they are excluded from the active set.
		assert.Equal(t, []SupportedResource{active}, clients.SupportedResources())
	})
}

func TestSupportedResourceCapabilities(t *testing.T) {
	folder := SupportedResource{GroupKind: dashboardTestGVK.GroupKind(), Capabilities: sets.New(CapabilityFolder)}
	skip := SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilitySkipValidation)}
	disabled := SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilityDisabled)}

	assert.True(t, folder.IsActive())
	assert.True(t, folder.IsValidated())
	assert.True(t, folder.IsFolderScoped())

	assert.False(t, skip.IsValidated())
	assert.True(t, skip.IsActive())

	assert.False(t, disabled.IsActive())
}

func TestSupportsFolderAnnotation(t *testing.T) {
	supported := []SupportedResource{
		{GroupKind: dashboardTestGVK.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
		{GroupKind: playlistKind, Capabilities: sets.New[string]()},
	}

	assert.True(t, supportsFolderAnnotation(supported, dashboardTestGVK), "folder-scoped kind")
	assert.False(t, supportsFolderAnnotation(supported, playlistGVK), "org-scoped kind in the set")
	assert.False(t, supportsFolderAnnotation(supported, schema.GroupVersionKind{Group: "other.grafana.app", Version: "v1", Kind: "Other"}), "kind not in the set")

	// Matches on group+kind regardless of version.
	other := schema.GroupVersionKind{Group: dashboardTestGVK.Group, Version: "v2", Kind: dashboardTestGVK.Kind}
	assert.True(t, supportsFolderAnnotation(supported, other))
}

func TestParseSupportedResources(t *testing.T) {
	t.Run("parses ids and capabilities", func(t *testing.T) {
		got, err := ParseSupportedResources([]string{
			"folder.grafana.app/Folder:folder",
			" dashboard.grafana.app/Dashboard:folder ",
			"dashboard.grafana.app/LibraryPanel:folder:disabled",
			"playlist.grafana.app/Playlist:disabled",
			"", // skipped
		})
		require.NoError(t, err)
		require.Len(t, got, 4)

		assert.Equal(t, schema.GroupKind{Group: "folder.grafana.app", Kind: "Folder"}, got[0].GroupKind)
		assert.True(t, got[0].IsFolderScoped())
		assert.True(t, got[0].IsActive())

		assert.Equal(t, schema.GroupKind{Group: "dashboard.grafana.app", Kind: "LibraryPanel"}, got[2].GroupKind)
		assert.True(t, got[2].IsFolderScoped())
		assert.False(t, got[2].IsActive())

		assert.Equal(t, schema.GroupKind{Group: "playlist.grafana.app", Kind: "Playlist"}, got[3].GroupKind)
		assert.False(t, got[3].IsFolderScoped())
		assert.False(t, got[3].IsActive())
	})

	t.Run("splits group and kind on the last slash", func(t *testing.T) {
		got, err := ParseSupportedResources([]string{"alerting.notifications.grafana.app/ContactPoint"})
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, schema.GroupKind{Group: "alerting.notifications.grafana.app", Kind: "ContactPoint"}, got[0].GroupKind)
	})

	for _, tc := range []struct {
		name  string
		entry string
	}{
		{"missing kind", "dashboard.grafana.app/"},
		{"missing group", "/Dashboard"},
		{"no slash", "Dashboard"},
		{"group without a dot", "dashboard/Dashboard"},
		{"unknown capability", "dashboard.grafana.app/Dashboard:bogus"},
		{"unqualified non-dotted pattern", "*-app/Settings"},
		{"unqualified trailing pattern", "grafana-*/Settings"},
		{"two wildcards", "*.*.grafana.app/Thing"},
		// The qualifier used to skip the single-wildcard check, and the collection then expanded
		// to nothing because only the first wildcard is matched against.
		{"two wildcards with a qualifier", "*.*.grafana.app@plugins.grafana.app/Settings"},
		{"collection on a concrete group", "playlist.grafana.app@plugins.grafana.app/Playlist"},
		{"collection without a dot", "*-app@plugins/Settings"},
	} {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			_, err := ParseSupportedResources([]string{tc.entry})
			require.Error(t, err)
		})
	}

	t.Run("rejects duplicate capability", func(t *testing.T) {
		_, err := ParseSupportedResources([]string{"dashboard.grafana.app/Dashboard:folder:folder"})
		require.Error(t, err)
	})

	t.Run("rejects duplicate resource id", func(t *testing.T) {
		_, err := ParseSupportedResources([]string{"dashboard.grafana.app/Dashboard:folder", "dashboard.grafana.app/Dashboard"})
		require.Error(t, err)
	})
}

// TestSingleAPIClients_PropagatesTraceContext verifies that the dynamic client built by
// singleAPIClients wraps its transport with otelhttp, so outbound requests to the apiserver
// carry a W3C traceparent header. Without this the operator's writes (resource creates,
// folder ensures, job status updates) show up as leaf spans with no children because the
// apiserver has no incoming context to continue the trace.
func TestSingleAPIClients_PropagatesTraceContext(t *testing.T) {
	var gotTraceparent string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTraceparent = r.Header.Get("traceparent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"PlaylistList","items":[]}`))
	}))
	defer srv.Close()

	// otelhttp captures the global propagator when the transport is built, so install
	// the W3C TraceContext propagator before the client (and its transport) is created.
	prevProp := otel.GetTextMapPropagator()
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() { otel.SetTextMapPropagator(prevProp) })

	provider := apiserver.RestConfigProviderFunc(func(_ context.Context) (*rest.Config, error) {
		return &rest.Config{Host: srv.URL}, nil
	})

	clients := newSingleAPIClients(provider)
	dyn, _, err := clients.GetClientsForResource(context.Background(), schema.GroupVersionResource{})
	require.NoError(t, err)

	// Start a sampled span so there is an active SpanContext for the propagator to inject.
	tp := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()))
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })
	ctx, span := tp.Tracer("test").Start(context.Background(), "outbound")

	gvr := schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}
	_, err = dyn.Resource(gvr).Namespace("default").List(ctx, metav1.ListOptions{})
	span.End()
	require.NoError(t, err)

	require.NotEmpty(t, gotTraceparent, "expected the dynamic client to send a traceparent header")
	assert.Contains(t, gotTraceparent, span.SpanContext().TraceID().String(),
		"traceparent should carry the active span's trace id")
}

func TestExpandCollections(t *testing.T) {
	// served builds a lister over "<group>/<Kind>" pairs, the shape discovery reports.
	served := func(pairs ...string) groupKindLister {
		kinds := make([]schema.GroupKind, 0, len(pairs))
		for _, pair := range pairs {
			group, kind, ok := strings.Cut(pair, "/")
			require.True(t, ok, "served pair %q must be <group>/<Kind>", pair)
			kinds = append(kinds, schema.GroupKind{Group: group, Kind: kind})
		}
		return func(context.Context) ([]schema.GroupKind, error) { return kinds, nil }
	}
	installed := served(
		"dashboard.grafana.app/Dashboard",
		"prometheus.datasource.grafana.app/DataSource",
		"loki.datasource.grafana.app/DataSource",
		"grafana.datasource.grafana.app/DataSource",
	)

	t.Run("expands a collection into the groups served inside it", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"*.datasource.grafana.app/DataSource"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), installed, configured, holdsEverything)
		require.NoError(t, err)
		require.ElementsMatch(t, []schema.GroupKind{
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
			{Group: "loki.datasource.grafana.app", Kind: "DataSource"},
		}, groupKinds(expanded), "built-in data sources hold no instances and are left out")
	})

	t.Run("carries the collection's capabilities onto every member", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"*.datasource.grafana.app/DataSource:skipvalidation"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), installed, configured, holdsEverything)
		require.NoError(t, err)
		require.Len(t, expanded, 2)
		for _, r := range expanded {
			require.False(t, r.IsValidated(), "member of the collection inherits its capabilities")
		}
	})

	// Its members are filtered out of the result anyway, and asking discovery for them makes an
	// inert declaration able to fail the clients every active resource needs: a provider error, or
	// a discovery error other than ErrGroupDiscoveryFailed, is not filtered by the predicate.
	t.Run("does not expand a disabled collection", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{
			"playlist.grafana.app/Playlist",
			"*.datasource.grafana.app/DataSource:disabled",
		})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), func(context.Context) ([]schema.GroupKind, error) {
			t.Fatal("discovery should not be consulted for a collection nobody acts on")
			return nil, nil
		}, configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{{Group: "playlist.grafana.app", Kind: "Playlist"}}, groupKinds(expanded))
	})

	t.Run("passes a concrete group through without asking discovery", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"playlist.grafana.app/Playlist"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), func(context.Context) ([]schema.GroupKind, error) {
			t.Fatal("discovery should not be consulted without a wildcard entry")
			return nil, nil
		}, configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{{Group: "playlist.grafana.app", Kind: "Playlist"}}, groupKinds(expanded))
	})

	// Provisioning must still start when the plugin serving a collection is uninstalled.
	t.Run("a collection with no served members expands to nothing", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"*.datasource.grafana.app/DataSource"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), served("dashboard.grafana.app/Dashboard"), configured, holdsEverything)
		require.NoError(t, err)
		require.Empty(t, expanded)
	})

	t.Run("expands a trailing-wildcard pattern", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"grafana-*@plugins.grafana.app/Settings"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), served(
			"grafana-slo-app/Settings",
			"acme-slo-app/Settings",
			"plugins.grafana.app/Settings",
		), configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{{Group: "grafana-slo-app", Kind: "Settings"}}, groupKinds(expanded))
	})

	t.Run("expands a pattern qualified with its collection", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"*-app@plugins.grafana.app/Settings"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), served(
			"grafana-slo-app/Settings",
			"grafana-app-sdk/Settings",
			"plugins.grafana.app/Settings",
		), configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{{Group: "grafana-slo-app", Kind: "Settings"}}, groupKinds(expanded),
			"only a group matching the pattern's literal part is a member")
	})

	t.Run("asks discovery once for several collections", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{
			"*.datasource.grafana.app/DataSource",
			"*.ext.grafana.app/Thing",
		})
		require.NoError(t, err)

		calls := 0
		expanded, err := expandCollections(t.Context(), func(context.Context) ([]schema.GroupKind, error) {
			calls++
			return []schema.GroupKind{
				{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
				{Group: "router-test.ext.grafana.app", Kind: "Thing"},
			}, nil
		}, configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, 1, calls, "the served groups are listed once for the whole set")
		require.ElementsMatch(t, []schema.GroupKind{
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
			{Group: "router-test.ext.grafana.app", Kind: "Thing"},
		}, groupKinds(expanded))
	})

	// Expanding onto a covered group that does not serve the kind yields an unresolvable client.
	t.Run("skips a covered group that does not serve the kind", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"*.grafana.app/Playlist"})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), served(
			"playlist.grafana.app/Playlist",
			"dashboard.grafana.app/Dashboard",
			"folder.grafana.app/Folder",
		), configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{{Group: "playlist.grafana.app", Kind: "Playlist"}}, groupKinds(expanded))
	})

	// The same group and kind twice is listed twice, and full sync deletes the duplicate as an
	// orphan at the same path.
	t.Run("does not expand onto a group that is also declared on its own", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{
			"prometheus.datasource.grafana.app/DataSource",
			"*.datasource.grafana.app/DataSource",
		})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), installed, configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
			{Group: "loki.datasource.grafana.app", Kind: "DataSource"},
		}, groupKinds(expanded))
		for _, r := range expanded {
			require.Equal(t, "datasource.grafana.app", r.Collection,
				"a member records the group it is stored under however it was declared")
		}
	})

	// Filtering the disabled declaration before expansion let the collection put the member back.
	t.Run("does not expand onto a member declared on its own and disabled", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{
			"prometheus.datasource.grafana.app/DataSource:disabled",
			"*.datasource.grafana.app/DataSource",
		})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), installed, configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
			{Group: "loki.datasource.grafana.app", Kind: "DataSource"},
		}, groupKinds(expanded))
		require.False(t, expanded[0].IsActive(), "the declaration is what the pipeline acts on")
		require.True(t, expanded[1].IsActive())
	})

	t.Run("expands a group covered by two patterns once", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{
			"*.datasource.grafana.app/DataSource",
			"*.grafana.app/DataSource",
		})
		require.NoError(t, err)

		expanded, err := expandCollections(t.Context(), installed, configured, holdsEverything)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
			{Group: "loki.datasource.grafana.app", Kind: "DataSource"},
		}, groupKinds(expanded))
	})

	t.Run("propagates a discovery failure", func(t *testing.T) {
		configured, err := ParseSupportedResources([]string{"*.datasource.grafana.app/DataSource"})
		require.NoError(t, err)

		_, err = expandCollections(t.Context(), func(context.Context) ([]schema.GroupKind, error) {
			return nil, errors.New("apis unreachable")
		}, configured, holdsEverything)
		require.ErrorContains(t, err, "apis unreachable")
	})
}

func TestMultiResourceClientsClientsFor(t *testing.T) {
	collection := NewMockResourceClients(t)
	plugins := NewMockResourceClients(t)
	dashboards := NewMockResourceClients(t)
	clients := &multiResourceClients{
		resourceClientsByAPIGroup: map[string]ResourceClients{
			"datasource.grafana.app": collection,
			"plugins.grafana.app":    plugins,
			"dashboard.grafana.app":  dashboards,
		},
		collections: []string{"*.datasource.grafana.app", "*-app@plugins.grafana.app"},
	}

	t.Run("resolves a member group to the collection's API server", func(t *testing.T) {
		got, ok := clients.clientsFor("prometheus.datasource.grafana.app")
		require.True(t, ok)
		require.Same(t, collection, got)
	})

	t.Run("resolves a member of a qualified collection", func(t *testing.T) {
		got, ok := clients.clientsFor("grafana-slo-app")
		require.True(t, ok)
		require.Same(t, plugins, got)
	})

	t.Run("prefers an exact match", func(t *testing.T) {
		got, ok := clients.clientsFor("dashboard.grafana.app")
		require.True(t, ok)
		require.Same(t, dashboards, got)
	})

	t.Run("reports an unregistered group", func(t *testing.T) {
		_, ok := clients.clientsFor("playlist.grafana.app")
		require.False(t, ok)
	})
}

func groupKinds(rs []SupportedResource) []schema.GroupKind {
	out := make([]schema.GroupKind, 0, len(rs))
	for _, r := range rs {
		out = append(out, r.GroupKind)
	}
	return out
}

// A transient discovery failure must not be cached: a cancelled or timed-out first call would
// otherwise leave every later sync and finalizer broken until restart.
func TestClientFactorySupportedResourcesRetriesAfterFailure(t *testing.T) {
	configured, err := ParseSupportedResources([]string{"*.datasource.grafana.app/DataSource"})
	require.NoError(t, err)

	provider := &flakyClientsProvider{err: errors.New("apis unreachable")}
	factory := &clientFactory{clientsProvider: provider, configuredResources: configured}

	_, err = factory.supportedResources(t.Context())
	require.ErrorContains(t, err, "apis unreachable")

	provider.err = nil
	_, err = factory.supportedResources(t.Context())
	require.NoError(t, err, "a later call retries instead of replaying the failure")
	require.Equal(t, 2, provider.calls)

	_, err = factory.supportedResources(t.Context())
	require.NoError(t, err)
	require.Equal(t, 2, provider.calls, "the first success is cached")
}

// flakyClientsProvider fails until err is cleared, then serves discovery (no groups by default).
type flakyClientsProvider struct {
	err       error
	calls     int
	discovery client.DiscoveryClient
}

func (p *flakyClientsProvider) GetClientsForKind(context.Context, schema.GroupVersionKind) (dynamic.Interface, client.DiscoveryClient, error) {
	p.calls++
	if p.err != nil {
		return nil, nil, p.err
	}
	if p.discovery != nil {
		return nil, p.discovery, nil
	}
	return nil, emptyDiscoveryClient{}, nil
}

func (p *flakyClientsProvider) GetClientsForResource(context.Context, schema.GroupVersionResource) (dynamic.Interface, client.DiscoveryClient, error) {
	return nil, nil, p.err
}

type emptyDiscoveryClient struct{ client.DiscoveryClient }

func (emptyDiscoveryClient) PreferredResources(context.Context, func(string) bool) ([]*metav1.APIResourceList, error) {
	return nil, nil
}

// A disabled declaration must survive expansion: dropping it first let the collection covering it
// put the member back, and the pipeline then acted on a resource configured as inert.
func TestClientFactorySupportedResourcesDropsDisabledMembers(t *testing.T) {
	configured, err := ParseSupportedResources([]string{
		"prometheus.datasource.grafana.app/DataSource:disabled",
		"*.datasource.grafana.app/DataSource",
	})
	require.NoError(t, err)

	factory := &clientFactory{
		clientsProvider:     &flakyClientsProvider{discovery: servedDiscoveryClient{}},
		configuredResources: configured,
	}

	supported, err := factory.supportedResources(t.Context())
	require.NoError(t, err)
	require.Equal(t, []schema.GroupKind{{Group: "loki.datasource.grafana.app", Kind: "DataSource"}},
		groupKinds(supported))
}

// servedDiscoveryClient serves two data source plugin groups.
type servedDiscoveryClient struct{ client.DiscoveryClient }

func (servedDiscoveryClient) PreferredResources(context.Context, func(string) bool) ([]*metav1.APIResourceList, error) {
	return []*metav1.APIResourceList{
		{GroupVersion: "prometheus.datasource.grafana.app/v0alpha1", APIResources: []metav1.APIResource{{Name: "datasources", Kind: "DataSource"}}},
		{GroupVersion: "loki.datasource.grafana.app/v0alpha1", APIResources: []metav1.APIResource{{Name: "datasources", Kind: "DataSource"}}},
	}, nil
}

// A group declared on its own passes through expansion, so a stale discovery failure there must
// not stop the collections that are healthy from expanding.
func TestDiscoveryKindsIgnoresFailuresOutsideCollections(t *testing.T) {
	configured, err := ParseSupportedResources([]string{
		"playlist.grafana.app/Playlist",
		"*.datasource.grafana.app/DataSource",
	})
	require.NoError(t, err)

	capture := &capturingDiscoveryClient{}
	_, err = discoveryKinds(&flakyClientsProvider{discovery: capture}, configured, holdsEverything)(t.Context())
	require.NoError(t, err)
	require.NotNil(t, capture.relevant, "the predicate is handed to discovery")
	assert.False(t, capture.relevant("playlist.grafana.app"),
		"a group declared on its own resolves, or fails, when a client for it is taken")
	assert.True(t, capture.relevant("loki.datasource.grafana.app"),
		"a member of a collection would otherwise go missing silently")
}

// capturingDiscoveryClient keeps the relevance predicate it was called with.
type capturingDiscoveryClient struct {
	client.DiscoveryClient
	relevant func(string) bool
}

func (c *capturingDiscoveryClient) PreferredResources(_ context.Context, relevant func(string) bool) ([]*metav1.APIResourceList, error) {
	c.relevant = relevant
	return nil, nil
}

// holdsEverything is the single-server case: one API server stores every collection.
func holdsEverything(string) bool { return true }

// Per-server factories resolve the whole configured set, so a server that stores no collection
// asks discovery nothing while every server agrees on what is supported. Partitioning the set
// instead split a member from the collection covering it, and left a server holding nothing with
// the static fallback set.
func TestClientFactoryPerServerExpansion(t *testing.T) {
	configured, err := ParseSupportedResources([]string{
		"dashboard.grafana.app/Dashboard:folder",
		"prometheus.datasource.grafana.app/DataSource",
		"*.datasource.grafana.app/DataSource",
	})
	require.NoError(t, err)

	factoryFor := func(api string, discovery client.DiscoveryClient) *clientFactory {
		return &clientFactory{
			clientsProvider:     &flakyClientsProvider{discovery: discovery},
			configuredResources: configured,
			storageGroup:        api,
		}
	}

	t.Run("a server that stores no collection asks discovery nothing", func(t *testing.T) {
		// A provider error is not filtered by the relevance predicate, so expansion would fail.
		supported, err := factoryFor("dashboard.grafana.app", nil).supportedResources(t.Context())
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{
			{Group: "dashboard.grafana.app", Kind: "Dashboard"},
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
		}, groupKinds(supported))
		require.Equal(t, "datasource.grafana.app", supported[1].Collection,
			"the member is stamped with the group that stores it, wherever it is resolved")
	})

	t.Run("the server that stores the collection expands it", func(t *testing.T) {
		supported, err := factoryFor("datasource.grafana.app", servedDiscoveryClient{}).supportedResources(t.Context())
		require.NoError(t, err)
		require.Equal(t, []schema.GroupKind{
			{Group: "dashboard.grafana.app", Kind: "Dashboard"},
			{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
			{Group: "loki.datasource.grafana.app", Kind: "DataSource"},
		}, groupKinds(supported), "the member declared on its own is not expanded onto twice")
		require.False(t, supported[1].IsFolderScoped(), "the explicit declaration keeps its own capabilities")
		require.Equal(t, "datasource.grafana.app", supported[1].Collection)
	})
}
