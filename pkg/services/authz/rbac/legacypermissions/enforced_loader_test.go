package legacypermissions_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationEnforcedLoaderStoredBasicRoles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			sql := db.NewTestStore(t)
			now := time.Now()
			role := ac.Role{Name: "basic:viewer", UID: "basic-viewer", OrgID: 1, Created: now, Updated: now}
			require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
				if _, err := sess.Insert(&role); err != nil {
					return err
				}
				if _, err := sess.Insert(&ac.BuiltinRole{Role: "Viewer", OrgID: 1, RoleID: role.ID, Created: now, Updated: now}); err != nil {
					return err
				}
				_, err := sess.Insert(&ac.Permission{RoleID: role.ID, Action: "dashboards:view", Scope: "dashboards:*", Created: now, Updated: now})
				return err
			}))
			actions := resourcepermissions.NewActionSetService()
			actions.StoreActionSet("dashboards:view", []string{"dashboards:read"})
			cfg := loaderConfig(cached)
			loader := legacypermissions.NewEnforcedLoader(legacysql.NewDatabaseProvider(sql), actions,
				localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), nil, nil)
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
			check := func(options ac.Options, action string) {
				t.Helper()
				got, err := loader.GetUserPermissions(context.Background(), requester, options)
				require.NoError(t, err)
				require.ElementsMatch(t, []ac.Permission{
					{Action: action, Scope: "dashboards:*"},
					{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
				}, got)
			}
			check(ac.Options{}, "dashboards:read")
			require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
				_, err := sess.Where("role_id = ?", role.ID).Cols("action").Update(&ac.Permission{Action: "dashboards:write"})
				return err
			}))
			if cached {
				check(ac.Options{}, "dashboards:read")
			} else {
				check(ac.Options{}, "dashboards:write")
			}
			cfg.RBAC.PermissionCache = false
			check(ac.Options{}, "dashboards:write")
			cfg.RBAC.PermissionCache = cached
			check(ac.Options{ReloadCache: true}, "dashboards:write")
		})
	}
}

func TestIntegrationEnforcedLoaderGlobalPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	actions := resourcepermissions.NewActionSetService()
	actions.StoreActionSet("dashboards:view", []string{"dashboards:read"})
	seedGrant(t, sql, "custom:global", 0, 7, ac.Permission{Action: "dashboards:view", Scope: "dashboards:*"})
	seedGrant(t, sql, "custom:local", 1, 7, ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:local"})
	loader := legacypermissions.NewEnforcedLoader(legacysql.NewDatabaseProvider(sql), actions,
		localcache.New(0, 0), loaderConfig(true), featuremgmt.WithFeatures(), nil, nil)
	got, err := loader.GetGlobalUserPermissions(context.Background(),
		&user.SignedInUser{UserID: 7, OrgID: 0, OrgRole: org.RoleNone}, []string{"dashboards:read"})
	require.NoError(t, err)
	require.Equal(t, map[string][]string{"dashboards:read": {"dashboards:*"}}, got)
}

func TestIntegrationEnforcedLoaderResolvesProviderPerRequest(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	providers := map[string]legacysql.LegacyDatabaseProvider{}
	for _, namespace := range []string{"stacks-1", "stacks-2"} {
		sql := db.NewTestStore(t)
		seedGrant(t, sql, "custom:tenant", 1, 7, ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:" + namespace})
		providers[namespace] = legacysql.NewDatabaseProvider(sql)
	}
	calls := 0
	unavailable := errors.New("database unavailable")
	loader := legacypermissions.NewEnforcedLoader(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		calls++
		provider, ok := providers[request.NamespaceValue(ctx)]
		if !ok {
			return nil, unavailable
		}
		return provider(ctx)
	}, resourcepermissions.NewActionSetService(), localcache.New(0, 0), loaderConfig(false), featuremgmt.WithFeatures(), nil, nil)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
	for _, namespace := range []string{"stacks-1", "stacks-2", "stacks-1"} {
		got, err := loader.GetUserPermissions(request.WithNamespace(context.Background(), namespace), requester, ac.Options{})
		require.NoError(t, err)
		require.ElementsMatch(t, []ac.Permission{
			{Action: "dashboards:read", Scope: "dashboards:uid:" + namespace},
			{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
		}, got)
	}
	got, err := loader.GetUserPermissions(context.Background(), requester, ac.Options{})
	require.ErrorIs(t, err, unavailable)
	require.Nil(t, got)
	require.Equal(t, 4, calls)
}

func TestIntegrationEnforcedLoaderReadsCurrentFeatureToggle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	features := featuremgmt.NewMockFeatureToggles(t)
	seedGrant(t, sql, "managed:filtered", 1, 7, ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one", Kind: "dashboards"})
	loader := legacypermissions.NewEnforcedLoader(legacysql.NewDatabaseProvider(sql), resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), loaderConfig(false), features, nil, nil)
	for _, enabled := range []bool{false, true, false} {
		features.EXPECT().IsEnabledGlobally(featuremgmt.FlagExcludeRedundantManagedPermissions).Return(enabled).Once()
		got, err := loader.GetUserPermissions(context.Background(), &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}, ac.Options{})
		require.NoError(t, err)
		want := []ac.Permission{{Action: "folders:read", Scope: "folders:uid:sharedwithme"}}
		if !enabled {
			want = append(want, ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one"})
		}
		require.ElementsMatch(t, want, got)
	}
}

func TestIntegrationEnforcedLoaderTeamsAndDuplicates(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	grant := ac.Permission{Action: "users:create"}
	seedGrant(t, sql, "custom:direct", 1, 7, grant)
	now := time.Now()
	role := ac.Role{Name: "custom:team", UID: "custom-team", OrgID: 1, Created: now, Updated: now}
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		if _, err := sess.Insert(&ac.Permission{RoleID: role.ID, Action: grant.Action, Created: now, Updated: now}); err != nil {
			return err
		}
		_, err := sess.Insert(&ac.TeamRole{RoleID: role.ID, OrgID: 1, TeamID: 42, Created: now})
		return err
	}))
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			loader := legacypermissions.NewEnforcedLoader(legacysql.NewDatabaseProvider(sql), resourcepermissions.NewActionSetService(),
				localcache.New(0, 0), loaderConfig(cached), featuremgmt.WithFeatures(), nil, nil)
			for _, options := range []ac.Options{{}, {}, {ReloadCache: true}} {
				got, err := loader.GetUserPermissions(context.Background(), &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone, TeamIDs: []int64{42}}, options)
				require.NoError(t, err)
				require.ElementsMatch(t, []ac.Permission{grant, grant, {Action: "folders:read", Scope: "folders:uid:sharedwithme"}}, got)
			}
		})
	}
}

type enforcedScopeResolver struct{ calls int }

func (r *enforcedScopeResolver) ResolveScope(_ context.Context, _ claims.NamespaceInfo, _ legacyscopes.ScopeReference) (string, error) {
	r.calls++
	return "resolved-user", nil
}

func TestIntegrationEnforcedLoaderScopeResolver(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedGrant(t, sql, "custom:user", 1, 7, ac.Permission{Action: "users:read", Scope: "users:id:7"})
	scopes := &enforcedScopeResolver{}
	loader := legacypermissions.NewEnforcedLoader(legacysql.NewDatabaseProvider(sql), resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), loaderConfig(false), featuremgmt.WithFeatures(), nil, scopes)
	got, err := loader.GetUserPermissions(request.WithNamespace(context.Background(), "stacks-1"),
		&user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}, ac.Options{})
	require.NoError(t, err)
	require.Equal(t, 1, scopes.calls)
	require.ElementsMatch(t, []ac.Permission{
		{Action: "users:read", Scope: "users:id:7"},
		{Action: "users:read", Scope: "users:uid:resolved-user"},
		{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
	}, got)
}
