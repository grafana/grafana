package resources

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/services/apiserver"
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
