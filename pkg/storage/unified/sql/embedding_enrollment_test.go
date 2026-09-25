package sql

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/generic"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func TestEmbeddingEnrollmentUsesInitialAndReloadedManifests(t *testing.T) {
	configs := resource.NewEmbeddingConfigRegistry()
	opts := &ServerOptions{
		Cfg: &setting.Cfg{
			EnableSearch:                     true,
			VectorIndexingEnabled:            true,
			EmbeddingProvider:                "test",
			VectorAllowedInternalCollections: []string{"notes.example.test/notes"},
		},
		Backend:       struct{ resource.StorageBackend }{},
		VectorBackend: struct{ vector.VectorBackend }{},
		Embedder:      &embedder.Embedder{},
		SearchOptions: resource.SearchOptions{EmbeddingConfig: configs},
	}
	serverOpts := resource.ResourceServerOptions{VectorMetrics: resource.ProvideVectorMetrics(nil)}
	require.NoError(t, withSearch(opts, &serverOpts), "live declarations are not required during construction")
	require.NoError(t, withVectorIndexers(opts, &serverOpts))
	require.NotNil(t, serverOpts.VectorReconciler)
	provider := serverOpts.Search.EmbeddingBuilders
	require.NotNil(t, provider)
	require.Error(t, provider.Validate())
	require.Empty(t, provider.Snapshot().Builders())

	for _, revision := range []int{1, 2} {
		configs.Reload([]*app.ManifestData{{
			Group: "notes.example.test",
			Embed: map[string]app.ManifestResourceEmbed{"notes": {ReembedVersion: revision}},
			Versions: []app.ManifestVersion{{Name: "v1", Kinds: []app.ManifestVersionKind{{
				Kind: "Note", Plural: "notes", Embed: &app.ManifestVersionKindEmbed{Fields: []app.ManifestVersionKindEmbedField{{Name: "text", Path: "spec.text"}}},
			}}}},
		}})
		require.NoError(t, provider.Validate())
		snapshot := provider.Snapshot()
		require.True(t, snapshot.Has("notes.example.test", "notes"))
		builders := snapshot.Builders()
		require.Len(t, builders, 1)
		require.Equal(t, revision, builders[0].Version())
		items, err := builders[0].Extract(t.Context(), &resourcepb.ResourceKey{Group: "notes.example.test", Resource: "notes", Name: "one"},
			[]byte(`{"apiVersion":"notes.example.test/v1","spec":{"text":"hello"}}`), "")
		require.NoError(t, err)
		require.Len(t, items, 1)
		require.Equal(t, "text: hello", items[0].Content)
	}
	configs.Reload()
	snapshot := provider.Snapshot()
	require.Empty(t, snapshot.Builders())
	require.False(t, snapshot.Has("notes.example.test", "notes"))
}

func TestEmbeddingEnrollmentUsesBuiltinDeclarations(t *testing.T) {
	opts := &ServerOptions{
		Cfg: &setting.Cfg{
			VectorIndexingEnabled:            true,
			VectorAllowedInternalCollections: []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"},
		},
		VectorBackend: struct{ vector.VectorBackend }{},
	}
	serverOpts := resource.ResourceServerOptions{VectorMetrics: resource.ProvideVectorMetrics(nil)}
	require.NoError(t, withSearch(opts, &serverOpts))
	provider := serverOpts.Search.EmbeddingBuilders
	require.NoError(t, provider.Validate())
	builders := provider.Snapshot().Builders()
	require.Len(t, builders, 2)
	require.IsType(t, dashboard.New(), builders[0])
	require.IsType(t, &generic.Builder{}, builders[1])
	for _, version := range []string{"v1", "v1beta1"} {
		items, err := builders[1].Extract(t.Context(), &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Name: "one"},
			[]byte(`{"apiVersion":"folder.grafana.app/`+version+`","spec":{"title":"Operations","description":"Service runbooks"}}`), "")
		require.NoError(t, err)
		require.Len(t, items, 1)
		require.Equal(t, "title: Operations\ndescription: Service runbooks", items[0].Content)
	}
}

func TestEmbeddingEnrollmentDisabledWithoutSearchOrIndexing(t *testing.T) {
	opts := &ServerOptions{
		Cfg: &setting.Cfg{
			EnableVectorBackend:              true,
			VectorAllowedInternalCollections: []string{"notes.example.test/notes"},
			VectorAllowedExternalCollections: []string{"external.example.test/articles"},
		},
		VectorBackend: struct{ vector.VectorBackend }{},
	}
	serverOpts := resource.ResourceServerOptions{VectorMetrics: resource.ProvideVectorMetrics(nil)}
	require.NoError(t, withSearch(opts, &serverOpts))
	require.Nil(t, serverOpts.Search.EmbeddingBuilders, "disabled consumers must not validate unavailable live declarations at startup")
	require.Nil(t, serverOpts.Search.EmbeddingConfig)
	require.Equal(t, opts.Cfg.VectorAllowedExternalCollections, serverOpts.Search.AllowedExternalCollections)
}

func TestVectorIndexersRespectSharedAllowlistAndGlobalControls(t *testing.T) {
	for _, tc := range []struct {
		name     string
		allowed  []string
		disabled bool
		provider string
		active   bool
	}{
		{name: "dashboard enabled", allowed: []string{"dashboard.grafana.app/dashboards"}, provider: "test", active: true},
		{name: "empty enrollment", provider: "test"},
		{name: "folders without dashboards", allowed: []string{"folder.grafana.app/folders"}, provider: "test", active: true},
		{name: "dashboards and folders", allowed: []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}, provider: "test", active: true},
		{name: "indexing disabled", allowed: []string{"dashboard.grafana.app/dashboards"}, provider: "test", disabled: true},
		{name: "provider disabled", allowed: []string{"dashboard.grafana.app/dashboards"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			opts := &ServerOptions{
				Cfg: &setting.Cfg{
					VectorAllowedInternalCollections: tc.allowed,
					VectorIndexingEnabled:            !tc.disabled,
					EmbeddingProvider:                tc.provider,
				},
				Backend:       struct{ resource.StorageBackend }{},
				VectorBackend: struct{ vector.VectorBackend }{},
				Embedder:      &embedder.Embedder{},
			}
			serverOpts := resource.ResourceServerOptions{VectorMetrics: resource.ProvideVectorMetrics(nil)}
			require.NoError(t, withSearch(opts, &serverOpts))
			require.NoError(t, withVectorIndexers(opts, &serverOpts))
			if tc.active {
				require.NotNil(t, serverOpts.VectorReconciler)
			} else {
				require.Nil(t, serverOpts.VectorReconciler)
			}
		})
	}
}

func TestVectorIndexersDeferBuilderSelectionUntilAfterConstruction(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.VectorIndexingEnabled = true
	cfg.EmbeddingProvider = "test"
	cfg.VectorAllowedInternalCollections = []string{"notes.example.test/notes"}
	// Any provider call would panic: the initial live manifests are not ready yet.
	provider := struct{ embed.BuilderProvider }{}
	_, err := NewUninitializedResourceServer(ServerOptions{
		Cfg:           cfg,
		Backend:       struct{ resource.StorageBackend }{},
		VectorBackend: struct{ vector.VectorBackend }{},
		Embedder:      &embedder.Embedder{},
		SearchOptions: resource.SearchOptions{EmbeddingBuilders: provider},
	})
	require.NoError(t, err)
}
