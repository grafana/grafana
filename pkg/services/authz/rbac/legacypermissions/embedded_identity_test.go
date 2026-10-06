package legacypermissions_test

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type observingMigratedResolver struct{ requester identity.Requester }

func (r *observingMigratedResolver) ResolveCurrentUserPermissions(_ context.Context, requester identity.Requester) ([]ac.Permission, error) {
	r.requester = requester
	return nil, nil
}

func TestIntegrationEmbeddedLegacyRequesterAssertions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(false)
	cfg.StackID = "12"
	migrated := &observingMigratedResolver{}
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &licensing.OSSLicensingService{}, migrated), cfg)
	empty, namespace, cacheKey, id := "", "stacks-12", "caller-cache-key", int64(7)
	for _, original := range []*string{nil, &empty, &namespace} {
		_, err := client.LegacyGetUserPermissions(context.Background(), ac.LegacyPermissionCaller("stacks-12"), types.LegacyGetUserPermissionsRequest{
			Namespace: "stacks-12", GlobalOrg: true,
			Identity: types.LegacyPermissionIdentity{
				Type: types.TypeUser, UID: "8", InternalID: &id, HasUniqueID: true,
				OrgRole: "None", IsGrafanaAdmin: true, TeamIDs: []int64{10}, Groups: []string{"external-group"},
				CacheKey: &cacheKey, RequesterNamespace: original,
			},
		})
		require.NoError(t, err)
		wantNamespace := namespace
		if original != nil {
			wantNamespace = *original
		}
		require.Equal(t, wantNamespace, migrated.requester.GetNamespace())
		require.Equal(t, int64(0), migrated.requester.GetOrgID())
		require.Equal(t, cacheKey, migrated.requester.GetCacheKey())
		require.Equal(t, "user:8", migrated.requester.GetUID())
		require.Equal(t, []string{"external-group"}, migrated.requester.GetGroups())
		require.Equal(t, []string{"external-group"}, migrated.requester.GetExternalGroups())
		require.Equal(t, []int64{10}, migrated.requester.GetTeams())
		require.True(t, migrated.requester.GetIsGrafanaAdmin())
	}
	wrongNamespace := "stacks-13"
	_, err := client.LegacyGetUserPermissions(context.Background(), ac.LegacyPermissionCaller("stacks-12"), types.LegacyGetUserPermissionsRequest{
		Namespace: "stacks-12", Identity: types.LegacyPermissionIdentity{RequesterNamespace: &wrongNamespace},
	})
	require.ErrorContains(t, err, "requester namespace does not match tenant scope")
}
