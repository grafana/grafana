package legacypermissions_test

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type searchTargetMigratedResolver struct {
	migratedGrants
	searchPermissions map[int64][]ac.Permission
	searchCalls       atomic.Int64
	searchError       error
	requester         identity.Requester
	options           ac.SearchOptions
}

func (r *searchTargetMigratedResolver) SearchUsersPermissions(_ context.Context, requester identity.Requester, _ int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	r.searchCalls.Add(1)
	r.requester, r.options = requester, options
	return r.searchPermissions, r.searchError
}

func TestIntegrationSharedLoaderSearchMergesMigratedTargets(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
	seedGrant(t, sql, "managed:target", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:legacy"})
	migrated := &searchTargetMigratedResolver{searchPermissions: map[int64][]ac.Permission{
		searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:migrated"}},
	}}
	cfg := loaderConfig(true)
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, migrated)
	client := legacypermissions.NewEmbeddedClient(loader, cfg)
	result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
	require.NoError(t, err)
	require.ElementsMatch(t, []types.Permission{{Action: "test:read", Scope: "tests:id:legacy"}, {Action: "test:read", Scope: "tests:id:migrated"}}, result.Permissions[searchLoaderTargetID])
	require.Equal(t, int64(1), migrated.searchCalls.Load())
}

func TestIntegrationSharedLoaderSearchTargetMergeLicenseTransitions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, edition := range []string{licensing.OpenSourceEdition, "Enterprise"} {
		t.Run(edition, func(t *testing.T) {
			sql := db.NewTestStore(t)
			seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
			seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
			license := &searchLoaderEditionLicense{edition: edition}
			migrated := &searchTargetMigratedResolver{searchPermissions: map[int64][]ac.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:migrated"}}}}
			cfg := loaderConfig(true)
			cache := localcache.New(0, 0)
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), cache, cfg, featuremgmt.WithFeatures(), license, migrated), cfg)
			for _, enabled := range []bool{false, true, false} {
				license.enabled = enabled
				before := migrated.searchCalls.Load()
				result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
				require.NoError(t, err)
				if enabled || edition == licensing.OpenSourceEdition {
					require.Equal(t, []types.Permission{{Action: "test:read", Scope: "tests:id:migrated"}}, result.Permissions[searchLoaderTargetID])
					require.Equal(t, before+1, migrated.searchCalls.Load())
				} else {
					require.Empty(t, result.Permissions[searchLoaderTargetID])
					require.Equal(t, before, migrated.searchCalls.Load())
				}
			}
			require.Empty(t, cache.Items(), "target merge must not cache a stale snapshot")
		})
	}
}

func TestIntegrationSharedLoaderSearchTargetMergeFailureRecovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
	legacy := ac.Permission{Action: "test:read", Scope: "tests:id:legacy"}
	seedGrant(t, sql, "managed:target", 1, searchLoaderTargetID, legacy)
	migrated := &searchTargetMigratedResolver{}
	cfg := loaderConfig(true)
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, migrated), cfg)
	for _, phase := range []struct {
		name, scope string
		err         error
	}{
		{"initial merge", "first", nil}, {"partial failure", "discard", errors.New("Zanzana unavailable")}, {"recovered", "recovered", nil}, {"revoked", "", nil},
	} {
		t.Run(phase.name, func(t *testing.T) {
			migrated.searchError = phase.err
			migrated.searchPermissions = map[int64][]ac.Permission{searchLoaderTargetID: {legacy, legacy}}
			want := []types.Permission{{Action: legacy.Action, Scope: legacy.Scope}}
			if phase.scope != "" {
				permission := ac.Permission{Action: "test:read", Scope: "tests:id:" + phase.scope}
				migrated.searchPermissions[searchLoaderTargetID] = append(migrated.searchPermissions[searchLoaderTargetID], permission)
				if phase.err == nil {
					want = append(want, types.Permission{Action: permission.Action, Scope: permission.Scope})
				}
			}
			result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
			require.NoError(t, err)
			require.ElementsMatch(t, want, result.Permissions[searchLoaderTargetID])
		})
	}
	require.Equal(t, int64(4), migrated.searchCalls.Load())
}

func TestIntegrationSharedLoaderSearchTargetMergeVisibility(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: fmt.Sprintf("users:id:%d", searchLoaderTargetID)})
	migrated := &searchTargetMigratedResolver{searchPermissions: map[int64][]ac.Permission{
		searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:visible"}}, searchLoaderCallerID: {{Action: "test:read", Scope: "tests:id:hidden"}},
	}}
	cfg := loaderConfig(true)
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, migrated), cfg)
	req := searchLoaderRequest()
	req.UserID = 0
	result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
	require.NoError(t, err)
	require.Equal(t, map[int64][]types.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:visible"}}}, result.Permissions)
	req.UserID = searchLoaderCallerID
	result, err = client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Empty(t, result.Permissions)
	require.Equal(t, int64(1), migrated.searchCalls.Load(), "denied targets must never be resolved")
}

func TestIntegrationSharedLoaderSearchTargetMergeRequesterAndFilters(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
	seedGrant(t, sql, "managed:directory", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersRead, Scope: "users:*"})
	migrated := &searchTargetMigratedResolver{}
	cfg := loaderConfig(true)
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, migrated), cfg)
	for _, target := range []int64{0, searchLoaderTargetID} {
		for _, prefix := range []bool{false, true} {
			req := searchLoaderRequest()
			original, key := "", "caller-cache-key"
			req.Caller.InternalID = nil
			req.Caller.RequesterNamespace, req.Caller.CacheKey = &original, &key
			req.Caller.TeamIDs = []int64{55}
			req.Caller.Groups = []string{"external-group"}
			req.UserID = target
			req.Scope = "tests:id:filtered"
			if prefix {
				req.Action = ""
				req.ActionPrefix = "test:"
			}
			_, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
			require.NoError(t, err)
			caller := migrated.requester
			require.Equal(t, "user:400", caller.GetID())
			require.Equal(t, "user:401", caller.GetUID())
			require.Equal(t, int64(1), caller.GetOrgID())
			require.Equal(t, "", caller.GetNamespace())
			require.Equal(t, key, caller.GetCacheKey())
			require.Equal(t, []int64{55}, caller.GetTeams())
			require.Equal(t, []string{"external-group"}, caller.GetExternalGroups())
			require.Equal(t, []string{"users:*"}, caller.GetPermissions()[ac.ActionUsersRead], "broad directory search needs server-resolved permissions")
			require.Equal(t, ac.SearchOptions{UserID: target, Action: req.Action, ActionPrefix: req.ActionPrefix, Scope: req.Scope}, migrated.options)
		}
	}
}

type searchMergeDirectory struct {
	usertest.FakeUserService
	queries []*user.SearchUsersQuery
}

func (d *searchMergeDirectory) Search(_ context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	d.queries = append(d.queries, query)
	return &user.SearchUserQueryResult{Users: []*user.UserSearchHitDTO{{ID: searchLoaderTargetID, UID: "target-one"}}}, nil
}

func TestIntegrationSharedLoaderSearchProviderMergesThroughUserDirectory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, mode := range []string{"broad", "user", "service account", "merge disabled"} {
		t.Run(mode, func(t *testing.T) {
			sql := db.NewTestStore(t)
			seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
			seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
			seedGrant(t, sql, "managed:directory", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersRead, Scope: "users:*"})
			seedGrant(t, sql, "managed:target", 1, searchLoaderTargetID, ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:legacy"})
			directory := &searchMergeDirectory{FakeUserService: usertest.FakeUserService{ExpectedUser: &user.User{ID: searchLoaderTargetID, UID: "target-one", IsServiceAccount: mode == "service account"}}}
			flags := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
			if mode == "merge disabled" {
				flags = featuremgmt.WithFeatures()
			}
			cfg := loaderConfig(true)
			loader := legacypermissions.ProvideLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, flags, &licensing.OSSLicensingService{}, &dashboardGrantClient{}, nil, directory)
			client := legacypermissions.NewEmbeddedClient(loader, cfg)
			req := searchLoaderRequest()
			req.Action = "dashboards:read"
			if mode == "broad" {
				req.UserID = 0
			}
			result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
			require.NoError(t, err)
			want := []types.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}}
			if mode != "merge disabled" {
				want = append(want, types.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"})
			}
			require.ElementsMatch(t, want, result.Permissions[searchLoaderTargetID])
			if mode == "broad" {
				require.Len(t, directory.queries, 1)
				require.Equal(t, int64(1), directory.queries[0].OrgID)
				require.Equal(t, []string{"users:*"}, directory.queries[0].SignedInUser.GetPermissions()[ac.ActionUsersRead])
			} else {
				require.Empty(t, directory.queries)
			}
		})
	}
}
