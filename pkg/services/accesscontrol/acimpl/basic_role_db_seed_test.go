package acimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegration_OSSBasicRolePermissions_PersistAndRefreshOnRegisterFixedRoles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	sql := db.InitTestDB(t)
	store := database.ProvideService(sql)

	svc := ProvideOSSService(
		setting.NewCfg(),
		store,
		&resourcepermissions.FakeActionSetSvc{},
		localcache.ProvideService(),
		featuremgmt.WithFeatures(),
		tracing.InitializeTracerForTest(),
		sql,
		permreg.ProvidePermissionRegistry(),
		nil,
	)

	require.NoError(t, svc.DeclareFixedRoles(accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name: "fixed:test:role",
			Permissions: []accesscontrol.Permission{
				{Action: "test:read", Scope: ""},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}))

	require.NoError(t, svc.RegisterFixedRoles(ctx))

	// verify permission is persisted to DB for basic:viewer
	require.NoError(t, sql.WithDbSession(ctx, func(sess *db.Session) error {
		var role accesscontrol.Role
		ok, err := sess.Table("role").Where("uid = ?", accesscontrol.BasicRoleUIDPrefix+"viewer").Get(&role)
		require.NoError(t, err)
		require.True(t, ok)

		var count int64
		count, err = sess.Table("permission").Where("role_id = ? AND action = ? AND scope = ?", role.ID, "test:read", "").Count()
		require.NoError(t, err)
		require.Equal(t, int64(1), count)
		return nil
	}))

	// ensure RegisterFixedRoles refreshes it back to defaults
	require.NoError(t, sql.WithDbSession(ctx, func(sess *db.Session) error {
		ts := time.Now()
		var role accesscontrol.Role
		ok, err := sess.Table("role").Where("uid = ?", accesscontrol.BasicRoleUIDPrefix+"viewer").Get(&role)
		require.NoError(t, err)
		require.True(t, ok)

		_, err = sess.Exec("DELETE FROM permission WHERE role_id = ?", role.ID)
		require.NoError(t, err)
		p := accesscontrol.Permission{
			RoleID:  role.ID,
			Action:  "custom:keep",
			Scope:   "",
			Created: ts,
			Updated: ts,
		}
		p.Kind, p.Attribute, p.Identifier = accesscontrol.SplitScope(p.Scope)
		_, err = sess.Table("permission").Insert(&p)
		return err
	}))

	svc2 := ProvideOSSService(
		setting.NewCfg(),
		store,
		&resourcepermissions.FakeActionSetSvc{},
		localcache.ProvideService(),
		featuremgmt.WithFeatures(),
		tracing.InitializeTracerForTest(),
		sql,
		permreg.ProvidePermissionRegistry(),
		nil,
	)
	require.NoError(t, svc2.DeclareFixedRoles(accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name: "fixed:test:role",
			Permissions: []accesscontrol.Permission{
				{Action: "test:read", Scope: ""},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}))
	require.NoError(t, svc2.RegisterFixedRoles(ctx))

	require.NoError(t, sql.WithDbSession(ctx, func(sess *db.Session) error {
		var role accesscontrol.Role
		ok, err := sess.Table("role").Where("uid = ?", accesscontrol.BasicRoleUIDPrefix+"viewer").Get(&role)
		require.NoError(t, err)
		require.True(t, ok)

		var count int64
		count, err = sess.Table("permission").Where("role_id = ? AND action = ? AND scope = ?", role.ID, "test:read", "").Count()
		require.NoError(t, err)
		require.Equal(t, int64(1), count)

		count, err = sess.Table("permission").Where("role_id = ? AND action = ?", role.ID, "custom:keep").Count()
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
		return nil
	}))
}
