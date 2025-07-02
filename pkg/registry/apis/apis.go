package apiregistry

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	dashboardinternal "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/ofrep"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/userstorage"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

type Service struct{}

// ProvideRegistryServiceSink is an entry point for each service that will force initialization
// and give each builder the chance to register itself with the main server.
// This also discovers and registers any GraphQL-capable API builders with the GraphQL federation system.
func ProvideRegistryServiceSink(
	dashboardBuilder *dashboardinternal.DashboardsAPIBuilder,
	snapshotsBuilder *dashboardsnapshot.SnapshotsAPIBuilder,
	featureToggleBuilder *featuretoggle.FeatureFlagAPIBuilder,
	datasourceBuilder *datasource.DataSourceAPIBuilder,
	folderBuilder *folders.FolderAPIBuilder,
	iamBuilder *iam.IdentityAccessManagementAPIBuilder,
	queryBuilder *query.QueryAPIBuilder,
	userStorageBuilder *userstorage.UserStorageAPIBuilder,
	secretBuilder *secret.SecretAPIBuilder,
	provisioningBuilder *provisioning.APIBuilder,
	ofrepBuilder *ofrep.APIBuilder,
) *Service {
	logger := log.New("api-registry")

	// Collect all API builders for GraphQL discovery
	builders := []builder.APIGroupBuilder{
		dashboardBuilder,
		snapshotsBuilder,
		featureToggleBuilder,
		datasourceBuilder,
		folderBuilder,
		iamBuilder,
		queryBuilder,
		userStorageBuilder,
		secretBuilder,
		provisioningBuilder,
		ofrepBuilder,
	}

	// Remove nil builders (some are conditionally registered)
	var validBuilders []builder.APIGroupBuilder
	for _, b := range builders {
		if b != nil {
			validBuilders = append(validBuilders, b)
		}
	}

	// Use GraphQL discovery to find GraphQL-capable builders
	discovery := builder.NewGraphQLDiscovery()
	graphqlProviders := discovery.DiscoverFromBuilders(validBuilders)

	// Register GraphQL providers with the global registry
	if len(graphqlProviders) > 0 {
		apiserver.RegisterGraphQLProviders(graphqlProviders)
		for _, provider := range graphqlProviders {
			logger.Debug("Registered GraphQL provider from API builder", "provider", fmt.Sprintf("%T", provider))
		}
		logger.Info("GraphQL providers registered from API builders", "count", len(graphqlProviders))
	}

	return &Service{}
}
