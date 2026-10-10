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
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
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

func TestIntegrationEmbeddedLegacyNoOrgMembershipAssertions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, tc := range []struct{ name, stack, namespace string }{
		{"unmapped", "", ""},
		{"self-managed", "", "org--1"},
		{"cloud-unmapped", "12", ""},
		{"cloud", "12", "stacks-12"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sql := db.NewTestStore(t)
			cfg := loaderConfig(false)
			cfg.StackID = tc.stack
			migrated := &observingMigratedResolver{}
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &licensing.OSSLicensingService{}, migrated), cfg)
			for _, cacheKey := range []string{"", "missing-org-cache-key"} {
				requester := &identity.StaticRequester{Type: types.TypeUser, UserID: 7, UserUID: "seven", OrgID: -1, Namespace: tc.namespace, CacheKey: cacheKey}
				_, err := ac.GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, cfg)
				require.NoError(t, err)
				require.NotNil(t, migrated.requester)
				require.Equal(t, int64(-1), migrated.requester.GetOrgID())
				require.Equal(t, tc.namespace, migrated.requester.GetNamespace())
				require.Equal(t, cacheKey, migrated.requester.GetCacheKey())
				require.Equal(t, requester.GetUID(), migrated.requester.GetUID())
			}
		})
	}
}

func TestIntegrationEmbeddedLegacyNoOrgMembershipNamespaceValidation(t *testing.T) {
	for _, tc := range []struct {
		name, stack, namespace, original string
		noOrgMembership                  bool
	}{
		{"sentinel without missing-membership state", "", "default", "org--1", false},
		{"other negative org", "", "default", "org--2", true},
		{"different organization", "", "org-2", "org-3", true},
		{"different stack", "12", "stacks-12", "stacks-13", true},
		{"self-managed sentinel in cloud", "12", "stacks-12", "org--1", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := loaderConfig(false)
			cfg.StackID = tc.stack
			client := legacypermissions.NewEmbeddedClient(nil, cfg)
			got, err := client.LegacyGetUserPermissions(t.Context(), ac.LegacyPermissionCaller(tc.namespace), legacyclient.LegacyGetUserPermissionsRequest{
				Namespace: tc.namespace, NoOrgMembership: tc.noOrgMembership,
				Identity: legacyclient.LegacyPermissionIdentity{RequesterNamespace: &tc.original},
			})
			require.ErrorContains(t, err, "requester namespace does not match tenant scope")
			require.Empty(t, got.Permissions)
		})
	}
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
		_, err := client.LegacyGetUserPermissions(context.Background(), ac.LegacyPermissionCaller("stacks-12"), legacyclient.LegacyGetUserPermissionsRequest{
			Namespace: "stacks-12", GlobalOrg: true,
			Identity: legacyclient.LegacyPermissionIdentity{
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
	_, err := client.LegacyGetUserPermissions(context.Background(), ac.LegacyPermissionCaller("stacks-12"), legacyclient.LegacyGetUserPermissionsRequest{
		Namespace: "stacks-12", Identity: legacyclient.LegacyPermissionIdentity{RequesterNamespace: &wrongNamespace},
	})
	require.ErrorContains(t, err, "requester namespace does not match tenant scope")
}
