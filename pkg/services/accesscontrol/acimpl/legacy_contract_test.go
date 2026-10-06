package acimpl

import (
	"context"
	"sync"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type contractEmbeddedClient struct {
	get func() legacyclient.Service
}

func (c contractEmbeddedClient) LegacyGetUserPermissions(ctx context.Context, caller types.AuthInfo, req legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error) {
	return c.get().LegacyGetUserPermissions(ctx, caller, req)
}

func wireContractEmbeddedClient(s *Service) {
	// Tests finish configuring the service before its first public enumeration.
	// Thereafter the actual loader, transport and client live for the whole fixture.
	s.legacyClient = contractEmbeddedClient{get: sync.OnceValue(func() legacyclient.Service {
		var migrated legacypermissions.MigratedPermissions
		if s.zanzanaResolver != nil {
			migrated = s.zanzanaResolver
		}
		return legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(s.sql, s.RoleCatalog(), s.actionResolver, s.cache, s.cfg, s.features, &licensing.OSSLicensingService{}, migrated), s.cfg)
	})}
}

func TestIntegrationLegacyRoutingContracts(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enabled := range []bool{false, true} {
		name := "disabled"
		if enabled {
			name = "enabled"
		}
		t.Run(name, func(t *testing.T) {
			require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAuthzLegacyUserPermissions: {State: memprovider.Enabled, Variants: map[string]any{"value": enabled}, DefaultVariant: "value"},
			})))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
			for _, test := range []struct {
				name string
				run  func(*testing.T)
			}{
				{"sources", TestIntegrationGetUserPermissions_ContractSources},
				{"requester-sources", TestIntegrationGetUserPermissions_ContractRequesterSources},
				{"direct-cache", TestIntegrationGetUserPermissions_ContractDirectCache},
				{"source-cache-clear", TestIntegrationGetUserPermissions_ContractSourceCacheClear},
				{"concurrency", TestIntegrationGetUserPermissions_ContractConcurrentIsolation},
				{"failed-refresh", TestIntegrationGetUserPermissions_ContractFailedRefresh},
				{"grafana-admin", TestIntegrationGetUserPermissions_ContractGrafanaAdmin},
				{"registrations", TestIntegrationGetUserPermissions_ContractRegistrations},
				{"representation", TestIntegrationGetUserPermissions_ContractRepresentation},
			} {
				t.Run(test.name, test.run)
			}
		})
	}
}
