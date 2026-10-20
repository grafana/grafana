package acimpl

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func replaceTestRole(name string, grant string, actions ...string) accesscontrol.RoleRegistration {
	permissions := make([]accesscontrol.Permission, 0, len(actions))
	for _, action := range actions {
		permissions = append(permissions, accesscontrol.Permission{Action: action})
	}
	return accesscontrol.RoleRegistration{
		Role:   accesscontrol.RoleDTO{Name: name, Permissions: permissions, OrgID: accesscontrol.GlobalOrgID},
		Grants: []string{grant},
	}
}

func setupReplaceTestService(t *testing.T) (*Service, db.DB) {
	t.Helper()
	sql := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	svc := ProvideOSSService(setting.NewCfg(), database.ProvideService(sql), &resourcepermissions.FakeActionSetSvc{},
		localcache.ProvideService(), featuremgmt.WithFeatures(), tracing.InitializeTracerForTest(), sql,
		permreg.ProvidePermissionRegistry(), nil, iam.Features{})
	// Another declaration, which replacing must leave alone.
	require.NoError(t, svc.DeclareFixedRoles(replaceTestRole("fixed:other:reader", string(org.RoleViewer), "other:read")))
	return svc, sql
}

// memoryActions returns the basic role's actions in memory.
func memoryActions(t *testing.T, svc *Service, basicRole string) []string {
	t.Helper()
	svc.rolesMu.RLock()
	defer svc.rolesMu.RUnlock()
	var actions []string
	for _, p := range svc.roles[basicRole].Permissions {
		actions = append(actions, p.Action)
	}
	slices.Sort(actions)
	return actions
}

// dbActions returns the basic role's actions in the database.
func dbActions(t *testing.T, sql db.DB, basicRole string) []string {
	t.Helper()
	var actions []string
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.SQL("SELECT p.action FROM permission p INNER JOIN role r ON r.id = p.role_id WHERE r.uid = ? ORDER BY p.action",
			accesscontrol.BasicRoleUIDPrefix+basicRole).Find(&actions)
	}))
	return actions
}

// dbRoles returns the names of the fixed roles in the database with prefix.
func dbRoles(t *testing.T, sql db.DB, prefix string) []string {
	t.Helper()
	var names []string
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.SQL("SELECT name FROM role WHERE name LIKE ? ORDER BY name", prefix+"%").Find(&names)
	}))
	return names
}

func TestIntegrationService_ReplaceFixedRoles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	t.Run("adds, changes and removes roles after initialization", func(t *testing.T) {
		svc, sql := setupReplaceTestService(t)
		require.NoError(t, svc.RegisterFixedRoles(ctx))

		reader := replaceTestRole("fixed:a:reader", string(org.RoleViewer), "a/books:get")
		writer := replaceTestRole("fixed:a:writer", string(org.RoleEditor), "a/books:create")
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner", reader, writer))

		require.Equal(t, []string{"a/books:get", "other:read"}, memoryActions(t, svc, string(org.RoleViewer)))
		require.Equal(t, []string{"a/books:create", "a/books:get", "other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
		require.Equal(t, []string{"a/books:create", "a/books:get", "other:read"}, dbActions(t, sql, "editor"))
		require.Equal(t, []string{"fixed:a:reader", "fixed:a:writer"}, dbRoles(t, sql, "fixed:a:"))

		// Change the writer and drop the reader.
		writer = replaceTestRole("fixed:a:writer", string(org.RoleEditor), "a/books:create", "a/books:delete")
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner", writer))

		require.Equal(t, []string{"other:read"}, memoryActions(t, svc, string(org.RoleViewer)))
		require.Equal(t, []string{"a/books:create", "a/books:delete", "other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
		require.Equal(t, []string{"other:read"}, dbActions(t, sql, "viewer"))
		require.Equal(t, []string{"a/books:create", "a/books:delete", "other:read"}, dbActions(t, sql, "editor"))
		require.Equal(t, []string{"fixed:a:writer"}, dbRoles(t, sql, "fixed:a:"))
		role, err := svc.GetRoleByName(ctx, 1, "fixed:a:writer")
		require.NoError(t, err)
		require.Len(t, role.Permissions, 2)

		// Remove everything.
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner"))
		require.Equal(t, []string{"other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
		require.Equal(t, []string{"other:read"}, dbActions(t, sql, "editor"))
		require.Empty(t, dbRoles(t, sql, "fixed:a:"))
		require.Equal(t, []string{"fixed:other:reader"}, dbRoles(t, sql, "fixed:other:"))
		_, err = svc.GetRoleByName(ctx, 1, "fixed:a:writer")
		require.ErrorIs(t, err, accesscontrol.ErrRoleNotFound)
	})

	t.Run("repeating a call changes nothing", func(t *testing.T) {
		svc, sql := setupReplaceTestService(t)
		require.NoError(t, svc.RegisterFixedRoles(ctx))

		writer := replaceTestRole("fixed:a:writer", string(org.RoleEditor), "a/books:create")
		for range 3 {
			require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner", writer))
		}
		require.Equal(t, []string{"a/books:create", "other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
		require.Equal(t, []string{"a/books:create", "other:read"}, dbActions(t, sql, "editor"))
		require.Len(t, svc.registrations.Slice(), 2)
	})

	t.Run("before initialization records the roles for RegisterFixedRoles", func(t *testing.T) {
		svc, sql := setupReplaceTestService(t)

		require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner", replaceTestRole("fixed:a:reader", string(org.RoleViewer), "a/books:get")))
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner", replaceTestRole("fixed:a:writer", string(org.RoleEditor), "a/books:create")))
		require.Empty(t, memoryActions(t, svc, string(org.RoleEditor)))

		require.NoError(t, svc.RegisterFixedRoles(ctx))
		require.Equal(t, []string{"a/books:create", "other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
		require.Equal(t, []string{"other:read"}, memoryActions(t, svc, string(org.RoleViewer)))
		require.Equal(t, []string{"fixed:a:writer"}, dbRoles(t, sql, "fixed:a:"))
	})

	t.Run("owners don't touch each other's roles", func(t *testing.T) {
		svc, _ := setupReplaceTestService(t)
		require.NoError(t, svc.RegisterFixedRoles(ctx))

		require.NoError(t, svc.ReplaceFixedRoles(ctx, "a", replaceTestRole("fixed:a:writer", string(org.RoleEditor), "a/books:create")))
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "b", replaceTestRole("fixed:b:writer", string(org.RoleEditor), "b/books:create")))
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "a"))
		require.Equal(t, []string{"b/books:create", "other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
	})

	t.Run("refuses invalid registrations and changes nothing", func(t *testing.T) {
		svc, _ := setupReplaceTestService(t)
		require.NoError(t, svc.RegisterFixedRoles(ctx))
		writer := replaceTestRole("fixed:a:writer", string(org.RoleEditor), "a/books:create")
		require.NoError(t, svc.ReplaceFixedRoles(ctx, "owner", writer))

		for name, regs := range map[string][]accesscontrol.RoleRegistration{
			"not fixed":           {replaceTestRole("custom:a", string(org.RoleEditor), "a/books:get")},
			"unknown basic role":  {replaceTestRole("fixed:a:reader", "Nobody", "a/books:get")},
			"declared twice":      {writer, writer},
			"another's role name": {replaceTestRole("fixed:other:reader", string(org.RoleViewer), "a/books:get")},
		} {
			require.Error(t, svc.ReplaceFixedRoles(ctx, "owner", regs...), name)
		}
		require.Equal(t, []string{"a/books:create", "other:read"}, memoryActions(t, svc, string(org.RoleEditor)))
	})
}
