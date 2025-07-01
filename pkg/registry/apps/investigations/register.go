package investigations

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/investigations/pkg/apis"
	investigationv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
	investigationapp "github.com/grafana/grafana/apps/investigations/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
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
		ManagedKinds:             investigationapp.GetKinds(),
		Authorizer:               investigationapp.GetAuthorizer(),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, investigationapp.New)
	return provider
}

// GetGraphQLSubgraph implements GraphQLSubgraphProvider interface
// This creates a GraphQL subgraph for the investigations app with auto-generated
// schema and resolvers based on the InvestigationKind.
func (p *InvestigationsAppProvider) GetGraphQLSubgraph() (graphqlsubgraph.GraphQLSubgraph, error) {
	// Get the group version for the investigations app
	gv := schema.GroupVersion{
		Group:   investigationv0alpha1.InvestigationKind().Group(),
		Version: investigationv0alpha1.InvestigationKind().Version(),
	}

	// Get the managed kinds
	kinds := []resource.Kind{
		investigationv0alpha1.InvestigationKind(),
	}

	// Create a storage adapter that bridges GraphQL storage interface
	// to the existing REST storage (if needed in the future)
	storageGetter := func(gvr schema.GroupVersionResource) graphqlsubgraph.Storage {
		// For now, return nil as investigations don't have custom storage adapter
		// This can be implemented later if needed
		return nil
	}

	// Create resource handler registry and register the investigation handler
	resourceHandlers := graphqlsubgraph.NewResourceHandlerRegistry()
	investigationHandler := NewInvestigationGraphQLHandler()
	resourceHandlers.RegisterHandler(investigationHandler)

	// Create the subgraph using the helper function
	return graphqlsubgraph.CreateSubgraphFromConfig(graphqlsubgraph.SubgraphProviderConfig{
		GroupVersion:     gv,
		Kinds:            kinds,
		StorageGetter:    storageGetter,
		ResourceHandlers: resourceHandlers,
	})
}
