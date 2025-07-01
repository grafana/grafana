package investigations

import (
	"github.com/grafana/grafana-app-sdk/app"
	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/investigations/pkg/apis"
	investigationv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
	investigationapp "github.com/grafana/grafana/apps/investigations/pkg/app"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type InvestigationsAppProvider struct {
	app.Provider
	cfg *setting.Cfg
}

// Ensure InvestigationsAppProvider implements GraphQLSubgraphProvider
var _ graphqlsubgraph.GraphQLSubgraphProvider = (*InvestigationsAppProvider)(nil)

func RegisterApp(
	cfg *setting.Cfg,
) *InvestigationsAppProvider {
	provider := &InvestigationsAppProvider{
		cfg: cfg,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:         investigationv0alpha1.GetOpenAPIDefinitions,
		LegacyStorageGetter:      provider.legacyStorageGetter,
		ManagedKinds:             investigationapp.GetKinds(),
		Authorizer:               investigationapp.GetAuthorizer(),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, investigationapp.New)
	return provider
}

// GetGraphQLSubgraph implements GraphQLSubgraphProvider interface
// This creates a GraphQL subgraph for the investigations app with auto-generated
// schema and resolvers based on Investigation and InvestigationIndex kinds.
func (p *InvestigationsAppProvider) GetGraphQLSubgraph() (graphqlsubgraph.GraphQLSubgraph, error) {
	// Get the group version for the investigations app
	gv := schema.GroupVersion{
		Group:   investigationv0alpha1.InvestigationKind().Group(),
		Version: investigationv0alpha1.InvestigationKind().Version(),
	}

	// Get the managed kinds
	kinds := []resource.Kind{
		investigationv0alpha1.InvestigationKind(),
		investigationv0alpha1.InvestigationIndexKind(),
	}

	// Create a storage adapter that bridges GraphQL storage interface
	// to the existing REST storage
	storageGetter := func(gvr schema.GroupVersionResource) graphqlsubgraph.Storage {
		// Handle investigation resources
		investigationGVR := schema.GroupVersionResource{
			Group:    gv.Group,
			Version:  gv.Version,
			Resource: investigationv0alpha1.InvestigationKind().Plural(),
		}

		// Handle investigation index resources
		investigationIndexGVR := schema.GroupVersionResource{
			Group:    gv.Group,
			Version:  gv.Version,
			Resource: investigationv0alpha1.InvestigationIndexKind().Plural(),
		}

		if gvr != investigationGVR && gvr != investigationIndexGVR {
			return nil
		}

		// Return a storage adapter that wraps the legacy storage
		legacyStore := p.legacyStorageGetter(gvr)
		if legacyStore == nil {
			return nil
		}

		return &investigationStorageAdapter{
			legacyStorage: legacyStore,
			namespacer:    request.GetNamespaceMapper(p.cfg),
		}
	}

	// Create resource handler registry and register the investigation handlers
	resourceHandlers := graphqlsubgraph.NewResourceHandlerRegistry()
	investigationHandler := NewInvestigationGraphQLHandler()
	investigationIndexHandler := NewInvestigationIndexGraphQLHandler()
	resourceHandlers.RegisterHandler(investigationHandler)
	resourceHandlers.RegisterHandler(investigationIndexHandler)

	// Create the subgraph using the helper function
	return graphqlsubgraph.CreateSubgraphFromConfig(graphqlsubgraph.SubgraphProviderConfig{
		GroupVersion:     gv,
		Kinds:            kinds,
		StorageGetter:    storageGetter,
		ResourceHandlers: resourceHandlers,
	})
}

func (p *InvestigationsAppProvider) legacyStorageGetter(requested schema.GroupVersionResource) grafanarest.Storage {
	// Handle Investigation resources
	investigationGVR := schema.GroupVersionResource{
		Group:    investigationv0alpha1.InvestigationKind().Group(),
		Version:  investigationv0alpha1.InvestigationKind().Version(),
		Resource: investigationv0alpha1.InvestigationKind().Plural(),
	}

	// Handle InvestigationIndex resources
	investigationIndexGVR := schema.GroupVersionResource{
		Group:    investigationv0alpha1.InvestigationIndexKind().Group(),
		Version:  investigationv0alpha1.InvestigationIndexKind().Version(),
		Resource: investigationv0alpha1.InvestigationIndexKind().Plural(),
	}

	if requested.String() == investigationGVR.String() || requested.String() == investigationIndexGVR.String() {
		// Use the singleton storage instance with actual persistence
		return getOrCreateStorage(requested, request.GetNamespaceMapper(p.cfg))
	}

	return nil
}
