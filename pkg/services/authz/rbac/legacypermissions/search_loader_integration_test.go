package legacypermissions_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	searchLoaderCallerID = int64(400)
	searchLoaderTargetID = int64(401)
)

func seedSearchLoaderUser(t *testing.T, sql db.DB, id int64, uid string, role org.RoleType) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(t.Context(), func(sess *db.Session) error {
		now := time.Now()
		if _, err := sess.Insert(&user.User{ID: id, UID: uid, Login: uid, Email: uid + "@example.test", OrgID: 1, Created: now, Updated: now}); err != nil {
			return err
		}
		_, err := sess.Insert(&org.OrgUser{OrgID: 1, UserID: id, Role: role, Created: now, Updated: now})
		return err
	}))
}

func searchLoaderCaller() legacyclient.LegacyPermissionIdentity {
	id := searchLoaderCallerID
	return legacyclient.LegacyPermissionIdentity{Type: types.TypeUser, UID: "401", InternalID: &id, HasUniqueID: true, OrgRole: string(org.RoleNone)}
}

func searchLoaderRequest() legacyclient.LegacySearchUsersPermissionsRequest {
	return legacyclient.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: searchLoaderCaller(), UserID: searchLoaderTargetID, Action: "test:read"}
}

func TestIntegrationSharedLoaderSearchLicenseTransitions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, withInternalID := range []bool{false, true} {
		t.Run(fmt.Sprintf("internal ID supplied=%t", withInternalID), func(t *testing.T) {
			sql := db.NewTestStore(t)
			// A numeric-looking UID identifies the caller, while the same number
			// identifies another user's legacy row. Neither RPC may parse the UID.
			seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
			seedGrant(t, sql, "managed:caller-search", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
			seedGrant(t, sql, "managed:target-direct", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:managed"})
			seedGrant(t, sql, "custom:target", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:custom"})
			seedGrant(t, sql, "fixed:target", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:fixed"})
			seedGrant(t, sql, "extsvc:global-target", 0, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:global"})
			catalog := legacypermissions.NewRoleCatalog()
			catalog.Replace(map[string][]ac.Permission{string(org.RoleViewer): {{Action: "test:read", Scope: "tests:id:static"}}})
			license := &enforcementLicense{}
			cache := localcache.New(0, 0)
			cfg := loaderConfig(false)
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, catalog, resourcepermissions.NewActionSetService(), cache, cfg, featuremgmt.WithFeatures(), license, nil), cfg)
			req := searchLoaderRequest()
			if !withInternalID {
				req.Caller.InternalID = nil
			}
			targetID := searchLoaderTargetID
			for _, phase := range []struct {
				name    string
				enabled bool
			}{{"license off", false}, {"license enabled after previous search", true}, {"license disabled after previous search", false}} {
				t.Run(phase.name, func(t *testing.T) {
					license.enabled = phase.enabled
					want := []types.Permission{{Action: "test:read", Scope: "tests:id:managed"}, {Action: "test:read", Scope: "tests:id:global"}}
					if phase.enabled {
						want = append(want, types.Permission{Action: "test:read", Scope: "tests:id:custom"}, types.Permission{Action: "test:read", Scope: "tests:id:fixed"})
					} else {
						want = append(want, types.Permission{Action: "test:read", Scope: "tests:id:static"})
					}
					searched, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
					require.NoError(t, err)
					require.Len(t, searched.Permissions, 1)
					require.ElementsMatch(t, want, searched.Permissions[searchLoaderTargetID])
					enumerated, err := client.LegacyGetUserPermissions(t.Context(), legacypermissions.LegacyPermissionCaller("default"), legacyclient.LegacyGetUserPermissionsRequest{
						Namespace: "default", ReloadCache: true,
						Identity: legacyclient.LegacyPermissionIdentity{Type: types.TypeUser, UID: "target-one", InternalID: &targetID, HasUniqueID: true, OrgRole: string(org.RoleViewer)},
					})
					require.NoError(t, err)
					wantEnumeration := append(slices.Clone(want), types.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"})
					require.ElementsMatch(t, wantEnumeration, enumerated.Permissions)
				})
			}
			require.Empty(t, cache.Items(), "search must not leave uninvalidated target snapshots")
		})
	}
}

func TestIntegrationSharedLoaderSearchRoleCatalogPublication(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller-search", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
	catalog := legacypermissions.NewRoleCatalog()
	cfg := loaderConfig(false)
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, catalog, resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil), cfg)
	for _, scope := range []string{"tests:id:first-registration", "tests:id:replacement-registration"} {
		catalog.Replace(map[string][]ac.Permission{string(org.RoleViewer): {{Action: "test:read", Scope: scope}}})
		req := searchLoaderRequest()
		req.UserID = 0
		searched, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
		require.NoError(t, err)
		require.Equal(t, map[int64][]types.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: scope}}}, searched.Permissions)
		targetID := searchLoaderTargetID
		enumerated, err := client.LegacyGetUserPermissions(t.Context(), legacypermissions.LegacyPermissionCaller("default"), legacyclient.LegacyGetUserPermissionsRequest{
			Namespace: "default", Identity: legacyclient.LegacyPermissionIdentity{Type: types.TypeUser, UID: "target-one", InternalID: &targetID, OrgRole: string(org.RoleViewer)},
		})
		require.NoError(t, err)
		require.ElementsMatch(t, []types.Permission{{Action: "test:read", Scope: scope}, {Action: "folders:read", Scope: "folders:uid:sharedwithme"}}, enumerated.Permissions)
	}
}

func seedSearchLoaderVisibilityRole(t *testing.T, sql db.DB, builtin string, teamID int64) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(t.Context(), func(sess *db.Session) error {
		now := time.Now()
		role := ac.Role{Name: "managed:caller-visibility", UID: "managed:caller-visibility", OrgID: 0, Created: now, Updated: now}
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		if _, err := sess.Insert(&ac.Permission{RoleID: role.ID, Action: ac.ActionUsersPermissionsRead, Scope: "users:*", Created: now, Updated: now}); err != nil {
			return err
		}
		if builtin != "" {
			_, err := sess.Insert(&ac.BuiltinRole{OrgID: 0, RoleID: role.ID, Role: builtin, Created: now, Updated: now})
			return err
		}
		_, err := sess.Insert(&ac.TeamRole{OrgID: 1, RoleID: role.ID, TeamID: teamID, Created: now})
		return err
	}))
}

type searchLoaderMigratedResolver struct {
	mu        sync.Mutex
	requester identity.Requester
}

func (r *searchLoaderMigratedResolver) ResolveCurrentUserPermissions(_ context.Context, requester identity.Requester) ([]ac.Permission, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.requester = requester
	if slices.Contains(requester.GetExternalGroups(), "search-reviewers") {
		return []ac.Permission{{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"}}, nil
	}
	return nil, nil
}

func TestIntegrationSharedLoaderSearchRequesterVisibilitySources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, source := range []string{"basic role assertion", "team assertion", "server admin assertion", "instance global grant", "external group assertion"} {
		for _, enforced := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/enforced=%t", source, enforced), func(t *testing.T) {
				sql := db.NewTestStore(t)
				seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
				seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
				seedGrant(t, sql, "managed:target", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:target"})
				req := searchLoaderRequest()
				migrated := &searchLoaderMigratedResolver{}
				switch source {
				case "basic role assertion":
					seedSearchLoaderVisibilityRole(t, sql, string(org.RoleAdmin), 0)
					req.Caller.OrgRole = string(org.RoleAdmin)
				case "team assertion":
					seedSearchLoaderVisibilityRole(t, sql, "", 77)
					req.Caller.TeamIDs = []int64{77}
				case "server admin assertion":
					seedSearchLoaderVisibilityRole(t, sql, ac.RoleGrafanaAdmin, 0)
					req.Caller.IsGrafanaAdmin = true
				case "instance global grant":
					seedGrant(t, sql, "extsvc:global-caller", 0, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
				case "external group assertion":
					req.Caller.Groups = []string{"search-reviewers"}
				default:
					t.Fatalf("unknown visibility source: %s", source)
				}
				cfg := loaderConfig(true)
				client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: enforced}, migrated), cfg)
				for _, phase := range []string{"uncached target", "repeated target"} {
					t.Run(phase, func(t *testing.T) {
						result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
						require.NoError(t, err)
						require.Equal(t, map[int64][]types.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:target"}}}, result.Permissions)
					})
				}
				migrated.mu.Lock()
				defer migrated.mu.Unlock()
				require.Equal(t, "user:401", migrated.requester.GetUID())
				require.Equal(t, "user:400", migrated.requester.GetID())
				require.Equal(t, "default", migrated.requester.GetNamespace())
				require.Equal(t, req.Caller.TeamIDs, migrated.requester.GetTeams())
				require.Equal(t, req.Caller.Groups, migrated.requester.GetExternalGroups())
				require.Equal(t, req.Caller.IsGrafanaAdmin, migrated.requester.GetIsGrafanaAdmin())
				require.Equal(t, identity.RoleType(req.Caller.OrgRole), migrated.requester.GetOrgRole())
			})
		}
	}
}

func TestIntegrationSharedLoaderSearchTeamInheritance(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller-search", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
	require.NoError(t, sql.WithDbSession(t.Context(), func(sess *db.Session) error {
		now := time.Now()
		group := team.Team{OrgID: 1, UID: "search-team", Name: "Search team", Created: now, Updated: now}
		if _, err := sess.Insert(&group); err != nil {
			return err
		}
		role := ac.Role{Name: "managed:team-target", UID: "managed:team-target", OrgID: 1, Created: now, Updated: now}
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		if _, err := sess.Insert(&ac.Permission{RoleID: role.ID, Action: "test:read", Scope: "tests:id:team", Created: now, Updated: now}); err != nil {
			return err
		}
		if _, err := sess.Insert(&ac.TeamRole{OrgID: 1, RoleID: role.ID, TeamID: group.ID, Created: now}); err != nil {
			return err
		}
		_, err := sess.Insert(&team.TeamMember{UID: "target-membership", OrgID: 1, TeamID: group.ID, UserID: searchLoaderTargetID, Permission: team.PermissionTypeMember, Created: now, Updated: now})
		return err
	}))
	cfg := loaderConfig(false)
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil), cfg)
	result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
	require.NoError(t, err)
	require.Equal(t, map[int64][]types.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:team"}}}, result.Permissions)
}

func TestIntegrationSharedLoaderSearchDiscardsPartialSQLResults(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	mockDB, mock, err := sqlmock.New()
	require.NoError(t, err)
	engineDB := sql.GetEngine().DB()
	original := engineDB.DB
	engineDB.DB = mockDB
	t.Cleanup(func() {
		engineDB.DB = original
		mock.ExpectClose()
		require.NoError(t, mockDB.Close())
		require.NoError(t, mock.ExpectationsWereMet())
	})
	cache := localcache.New(0, 0)
	cfg := loaderConfig(false)
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), cache, cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil), cfg)
	boom := errors.New("driver lost connection after first permission")
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(searchLoaderCallerID)).RowsWillBeClosed()
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows([]string{"action", "scope"}).AddRow(ac.ActionUsersPermissionsRead, "users:*")).RowsWillBeClosed()
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows([]string{"id", "role", "is_admin"}).AddRow(searchLoaderTargetID, "Viewer", false)).RowsWillBeClosed()
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows([]string{"user_id", "action", "scope"}).AddRow(searchLoaderTargetID, "test:read", "tests:id:one").AddRow(searchLoaderTargetID, "test:read", "tests:id:two").RowError(1, boom)).RowsWillBeClosed()
	searched, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
	require.Equal(t, codes.Internal, status.Code(err))
	require.ErrorContains(t, err, boom.Error())
	require.Nil(t, searched.Permissions)
	require.Empty(t, cache.Items())
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows([]string{"action", "scope"}).AddRow("test:read", "tests:id:one").AddRow("test:read", "tests:id:two").RowError(1, boom)).RowsWillBeClosed()
	enumerated, err := client.LegacyGetUserPermissions(t.Context(), legacypermissions.LegacyPermissionCaller("default"), legacyclient.LegacyGetUserPermissionsRequest{Namespace: "default", Identity: searchLoaderCaller()})
	require.ErrorContains(t, err, boom.Error())
	require.Empty(t, enumerated.Permissions)
}

func TestIntegrationSharedLoaderSearchMembership(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enforced := range []bool{false, true} {
		t.Run(fmt.Sprintf("enforced=%t", enforced), func(t *testing.T) {
			sql := db.NewTestStore(t)
			seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "global-target", org.RoleNone)
			const emptyTargetID = searchLoaderTargetID + 1
			seedSearchLoaderUser(t, sql, emptyTargetID, "empty-target", org.RoleNone)
			require.NoError(t, sql.WithDbSession(t.Context(), func(sess *db.Session) error {
				now := time.Now()
				if _, err := sess.Insert(&org.Org{ID: 2, Name: "Other search organization", Created: now, Updated: now}); err != nil {
					return err
				}
				if _, err := sess.Exec("UPDATE org_user SET org_id = ? WHERE user_id IN (?, ?)", 2, searchLoaderTargetID, emptyTargetID); err != nil {
					return err
				}
				_, err := sess.Exec("UPDATE "+sql.Quote("user")+" SET org_id = ? WHERE id IN (?, ?)", 2, searchLoaderTargetID, emptyTargetID)
				return err
			}))
			seedGrant(t, sql, "managed:membership-caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
			seedGrant(t, sql, "managed:membership-global", 0, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:global"})
			cfg := loaderConfig(false)
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: enforced}, nil), cfg)
			for _, tc := range []struct {
				name    string
				target  int64
				action  string
				granted bool
			}{
				{"global assignment in bulk search", 0, "test:read", true},
				{"global assignment in target search", searchLoaderTargetID, "test:read", true},
				{"target without matching action", searchLoaderTargetID, "test:missing", false},
				{"nonmember without grants", emptyTargetID, "test:read", false},
			} {
				t.Run(tc.name, func(t *testing.T) {
					req := searchLoaderRequest()
					req.UserID, req.Action = tc.target, tc.action
					got, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
					if !enforced && tc.target > 0 {
						require.Equal(t, codes.Internal, status.Code(err))
						require.Nil(t, got.Permissions)
						return
					}
					require.NoError(t, err)
					want := map[int64][]types.Permission{}
					if enforced && tc.granted {
						want[searchLoaderTargetID] = []types.Permission{{Action: "test:read", Scope: "tests:id:global"}}
					} else if enforced && tc.target > 0 {
						want[tc.target] = []types.Permission{}
					}
					require.Equal(t, want, got.Permissions)
				})
			}
		})
	}
}

func TestIntegrationSharedLoaderSearchTransaction(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enforced := range []bool{false, true} {
		t.Run(fmt.Sprintf("enforced=%t", enforced), func(t *testing.T) {
			sql := db.NewTestStore(t)
			seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleNone)
			seedGrant(t, sql, "managed:caller-search", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
			seedGrant(t, sql, "managed:target-search", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:before"})
			cfg := loaderConfig(true)
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: enforced}, nil), cfg)
			check := func(ctx context.Context, scope string) {
				t.Helper()
				result, err := client.LegacySearchUsersPermissions(ctx, legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
				require.NoError(t, err)
				require.Equal(t, []types.Permission{{Action: "test:read", Scope: scope}}, result.Permissions[searchLoaderTargetID])
			}
			check(t.Context(), "tests:id:before")
			rollback := errors.New("rollback target mutation")
			err := sql.InTransaction(t.Context(), func(ctx context.Context) error {
				require.NoError(t, sql.WithDbSession(ctx, func(sess *db.Session) error {
					_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", "tests:id:after", "tests:id:before")
					return err
				}))
				check(ctx, "tests:id:after")
				return rollback
			})
			require.ErrorIs(t, err, rollback)
			check(t.Context(), "tests:id:before")
		})
	}
}

type searchLoaderEditionLicense struct {
	enforcementLicense
	edition string
}

func (l *searchLoaderEditionLicense) Edition() string { return l.edition }

func TestIntegrationSharedLoaderSearchMigratedVisibilityLicense(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, tt := range []struct {
		name     string
		edition  string
		enforced bool
		allowed  bool
	}{
		{"OSS without enforcement", licensing.OpenSourceEdition, false, true},
		{"Enterprise without enforcement", "Enterprise", false, false},
		{"Enterprise with enforcement", "Enterprise", true, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			sql := db.NewTestStore(t)
			seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
			seedGrant(t, sql, "managed:target", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:target"})
			migrated := &migratedGrants{permissions: []ac.Permission{{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"}}}
			license := &searchLoaderEditionLicense{enforcementLicense: enforcementLicense{enabled: tt.enforced}, edition: tt.edition}
			cfg := loaderConfig(true)
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), license, migrated), cfg)
			for range 2 {
				result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), searchLoaderRequest())
				if tt.allowed {
					require.NoError(t, err)
					require.Equal(t, map[int64][]types.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:target"}}}, result.Permissions)
				} else {
					require.Equal(t, codes.PermissionDenied, status.Code(err))
					require.Nil(t, result.Permissions)
				}
			}
			if tt.allowed {
				require.Equal(t, 2, migrated.calls)
			} else {
				require.Zero(t, migrated.calls)
			}
		})
	}
}

func (r *searchLoaderMigratedResolver) SearchUsersPermissions(context.Context, identity.Requester, int64, ac.SearchOptions) (map[int64][]ac.Permission, error) {
	return nil, nil
}

func TestIntegrationSharedLoaderSearchLegacyCallerRoles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enforced := range []bool{false, true} {
		t.Run(fmt.Sprintf("enforcement=%t", enforced), func(t *testing.T) {
			sql := db.NewTestStore(t)
			seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target", org.RoleNone)
			seedGrant(t, sql, "managed:target", 1, searchLoaderTargetID, ac.Permission{Action: "test:read", Scope: "tests:id:one"})
			seedGrant(t, sql, "managed:target-visibility", 1, searchLoaderTargetID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: "users:*"})
			seedSearchLoaderVisibilityRole(t, sql, string(org.RoleAdmin), 0)
			cfg := loaderConfig(false)
			client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: enforced}, nil), cfg)
			for _, kind := range []types.IdentityType{types.TypeAnonymous, types.TypeRenderService, types.TypeAPIKey} {
				t.Run(string(kind), func(t *testing.T) {
					id := searchLoaderTargetID
					req := searchLoaderRequest()
					req.Caller = legacyclient.LegacyPermissionIdentity{Type: kind, UID: fmt.Sprint(id), InternalID: &id, OrgRole: string(org.RoleAdmin)}
					got, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
					require.NoError(t, err)
					require.Equal(t, map[int64][]types.Permission{searchLoaderTargetID: {{Action: "test:read", Scope: "tests:id:one"}}}, got.Permissions)
					// A non-user ID must not inherit a user's direct grants even when the numeric IDs collide.
					req.Caller.OrgRole = string(org.RoleNone)
					_, err = client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
					require.Equal(t, codes.PermissionDenied, status.Code(err))
				})
			}
		})
	}
}
