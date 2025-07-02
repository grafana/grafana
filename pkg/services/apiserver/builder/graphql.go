package builder

import (
	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
)

// GraphQLCapableBuilder is an optional interface that API builders can implement
// to provide GraphQL federation support. This allows APIs to expose their resources
// through GraphQL without requiring changes to the core API builder interfaces.
//
// Any API builder that implements this interface will be automatically discovered
// and registered with the GraphQL federation system.
type GraphQLCapableBuilder interface {
	APIGroupBuilder

	// GetGraphQLSubgraph returns the GraphQL subgraph for this API.
	// The subgraph includes auto-generated GraphQL schema and resolvers
	// based on the API's managed resources.
	GetGraphQLSubgraph() (graphqlsubgraph.GraphQLSubgraph, error)
}

// GraphQLDiscovery provides functionality to discover and register
// GraphQL-capable API builders with the federation system.
type GraphQLDiscovery struct {
	providers []graphqlsubgraph.GraphQLSubgraphProvider
}

// NewGraphQLDiscovery creates a new GraphQL discovery instance
func NewGraphQLDiscovery() *GraphQLDiscovery {
	return &GraphQLDiscovery{
		providers: make([]graphqlsubgraph.GraphQLSubgraphProvider, 0),
	}
}

// DiscoverFromBuilders scans a list of API builders and extracts any that
// implement GraphQLCapableBuilder
func (d *GraphQLDiscovery) DiscoverFromBuilders(builders []APIGroupBuilder) []graphqlsubgraph.GraphQLSubgraphProvider {
	var graphqlProviders []graphqlsubgraph.GraphQLSubgraphProvider

	for _, builder := range builders {
		if graphqlBuilder, ok := builder.(GraphQLCapableBuilder); ok {
			graphqlProviders = append(graphqlProviders, graphqlBuilder)
		}
	}

	return graphqlProviders
}

// RegisterProviders registers discovered GraphQL providers with the global registry
func (d *GraphQLDiscovery) RegisterProviders(providers []graphqlsubgraph.GraphQLSubgraphProvider) {
	d.providers = append(d.providers, providers...)
}

// GetProviders returns all discovered providers
func (d *GraphQLDiscovery) GetProviders() []graphqlsubgraph.GraphQLSubgraphProvider {
	return d.providers
}
