package database

import (
	"context"
	"regexp"
	"sync"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerRoleStoreSQLMockDriverOnce sync.Once

type roleStoreSQLMockDriver struct{}

func (roleStoreSQLMockDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockRoleStoreDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockRoleStoreDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockRoleStoreDB) WithTransactionalDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockRoleStoreDB) withSession(callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockRoleStoreDB) GetDBType() core.DbType {
	return core.SQLITE
}

func (d *sqlmockRoleStoreDB) Quote(value string) string {
	return d.engine.Quote(value)
}

func newQualifiedRoleStore(t *testing.T) (*RoleStore, sqlmock.Sqlmock) {
	t.Helper()
	registerRoleStoreSQLMockDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", roleStoreSQLMockDriver{})
		}
	})

	dsn := "role-store-" + t.Name()
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	t.Cleanup(func() { require.NoError(t, mock.ExpectationsWereMet()) })
	store := NewRoleStore(&sqlmockRoleStoreDB{engine: engine}, func(name string) string { return "test_schema." + name })
	return store, mock
}

func TestRoleStoreQualifiesTables(t *testing.T) {
	t.Run("LoadRoles", func(t *testing.T) {
		store, mock := newQualifiedRoleStore(t)
		mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`role` WHERE")).
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(int64(1), "fixed:test:reader"))
		mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`permission` WHERE")).
			WithArgs(int64(1)).
			WillReturnRows(sqlmock.NewRows([]string{"role_id", "action", "scope"}).AddRow(int64(1), "test:read", ""))

		roles, err := store.LoadRoles(t.Context())
		require.NoError(t, err)
		require.Contains(t, roles, "fixed:test:reader")
		require.Len(t, roles["fixed:test:reader"].Permissions, 1)
	})

	t.Run("SetRole", func(t *testing.T) {
		store, mock := newQualifiedRoleStore(t)
		mock.ExpectExec(regexp.QuoteMeta("UPDATE `test_schema`.`role` SET")).
			WillReturnResult(sqlmock.NewResult(0, 1))

		err := store.SetRole(t.Context(), &accesscontrol.RoleDTO{ID: 1, Version: 1}, accesscontrol.RoleDTO{Description: "updated"})
		require.NoError(t, err)
	})

	t.Run("SetPermissions", func(t *testing.T) {
		store, mock := newQualifiedRoleStore(t)
		mock.ExpectExec(regexp.QuoteMeta("DELETE FROM `test_schema`.`permission` WHERE role_id = ?")).
			WithArgs(int64(1), "old:action", "").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `test_schema`.`permission`")).
			WillReturnResult(sqlmock.NewResult(2, 1))

		err := store.SetPermissions(t.Context(),
			&accesscontrol.RoleDTO{ID: 1, Permissions: []accesscontrol.Permission{{Action: "old:action"}}},
			accesscontrol.RoleDTO{Permissions: []accesscontrol.Permission{{Action: "new:action"}}},
		)
		require.NoError(t, err)
	})

	t.Run("CreateRole", func(t *testing.T) {
		store, mock := newQualifiedRoleStore(t)
		mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `test_schema`.`role`")).
			WillReturnResult(sqlmock.NewResult(42, 1))
		mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `test_schema`.`permission`")).
			WithArgs(int64(42), "test:read", "",
				sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		err := store.CreateRole(t.Context(), accesscontrol.RoleDTO{
			Name:        "fixed:test:reader",
			Permissions: []accesscontrol.Permission{{Action: "test:read"}, {Action: "test:read"}},
		})
		require.NoError(t, err)
	})

	t.Run("DeleteRoles", func(t *testing.T) {
		store, mock := newQualifiedRoleStore(t)
		mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`role` WHERE")).
			WillReturnRows(sqlmock.NewRows([]string{"id", "uid"}).AddRow(int64(1), "test_uid"))
		for _, table := range []string{"permission", "user_role", "team_role", "builtin_role"} {
			mock.ExpectExec(regexp.QuoteMeta("DELETE FROM `test_schema`.`" + table + "` WHERE role_id IN (?)")).
				WithArgs(int64(1)).
				WillReturnResult(sqlmock.NewResult(0, 1))
		}
		mock.ExpectExec(regexp.QuoteMeta("DELETE FROM `test_schema`.`role` WHERE org_id = ? AND uid IN (?)")).
			WithArgs(int64(accesscontrol.GlobalOrgID), "test_uid").
			WillReturnResult(sqlmock.NewResult(0, 1))

		require.NoError(t, store.DeleteRoles(t.Context(), []string{"test_uid"}))
	})
}
