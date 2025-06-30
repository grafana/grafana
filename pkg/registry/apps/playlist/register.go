package playlist

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/playlist/pkg/apis"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistapp "github.com/grafana/grafana/apps/playlist/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
)

type PlaylistAppProvider struct {
	app.Provider
	cfg     *setting.Cfg
	service playlistsvc.Service
}

// Ensure PlaylistAppProvider implements GraphQLSubgraphProvider
var _ graphqlsubgraph.GraphQLSubgraphProvider = (*PlaylistAppProvider)(nil)

func RegisterApp(
	p playlistsvc.Service,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) *PlaylistAppProvider {
	provider := &PlaylistAppProvider{
		cfg:     cfg,
		service: p,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:    playlistv0alpha1.GetOpenAPIDefinitions,
		LegacyStorageGetter: provider.legacyStorageGetter,
		ManagedKinds:        playlistapp.GetKinds(),
		CustomConfig: any(&playlistapp.PlaylistConfig{
			EnableReconcilers: features.IsEnabledGlobally(featuremgmt.FlagPlaylistsReconciler),
		}),
		AllowedV0Alpha1Resources: []string{playlistv0alpha1.PlaylistKind().Plural()},
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, playlistapp.New)
	return provider
}

// GetGraphQLSubgraph implements GraphQLSubgraphProvider interface
// This creates a GraphQL subgraph for the playlist app with auto-generated
// schema and resolvers based on the PlaylistKind.
func (p *PlaylistAppProvider) GetGraphQLSubgraph() (graphqlsubgraph.GraphQLSubgraph, error) {
	// Get the group version for the playlist app
	gv := schema.GroupVersion{
		Group:   playlistv0alpha1.PlaylistKind().Group(),
		Version: playlistv0alpha1.PlaylistKind().Version(),
	}

	// Get the managed kinds
	kinds := []resource.Kind{
		playlistv0alpha1.PlaylistKind(),
	}

	// Create a storage adapter that bridges GraphQL storage interface
	// to the existing REST storage
	storageGetter := func(gvr schema.GroupVersionResource) graphqlsubgraph.Storage {
		// Only handle playlist resources
		expectedGVR := schema.GroupVersionResource{
			Group:    gv.Group,
			Version:  gv.Version,
			Resource: playlistv0alpha1.PlaylistKind().Plural(),
		}

		if gvr != expectedGVR {
			return nil
		}

		// Return a storage adapter that wraps the legacy storage
		legacyStore := p.legacyStorageGetter(gvr)
		if legacyStore == nil {
			return nil
		}

		return &playlistStorageAdapter{
			legacyStorage: legacyStore,
			namespacer:    request.GetNamespaceMapper(p.cfg),
		}
	}

	// Create resource handler registry and register the playlist handler
	resourceHandlers := graphqlsubgraph.NewResourceHandlerRegistry()
	playlistHandler := NewPlaylistGraphQLHandler()
	resourceHandlers.RegisterHandler(playlistHandler)

	// Create the subgraph using the helper function
	return graphqlsubgraph.CreateSubgraphFromConfig(graphqlsubgraph.SubgraphProviderConfig{
		GroupVersion:     gv,
		Kinds:            kinds,
		StorageGetter:    storageGetter,
		ResourceHandlers: resourceHandlers,
	})
}

func (p *PlaylistAppProvider) legacyStorageGetter(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := schema.GroupVersionResource{
		Group:    playlistv0alpha1.PlaylistKind().Group(),
		Version:  playlistv0alpha1.PlaylistKind().Version(),
		Resource: playlistv0alpha1.PlaylistKind().Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := &legacyStorage{
		service:    p.service,
		namespacer: request.GetNamespaceMapper(p.cfg),
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string", Format: "string", Description: "The playlist name"},
				{Name: "Interval", Type: "string", Format: "string", Description: "How often the playlist will update"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*playlistv0alpha1.Playlist)
				if !ok {
					return nil, fmt.Errorf("expected playlist")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.Spec.Interval,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		},
	)
	return legacyStore
}
