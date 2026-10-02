package teamimpl

import (
	"context"
	"regexp"
	"sync"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerTeamSQLMockXormDriverOnce sync.Once

type teamSQLMockXormDriver struct{}

func (teamSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockTeamDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockTeamDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockTeamDB) WithTransactionalDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.WithDbSession(context.Background(), callback)
}

func (d *sqlmockTeamDB) GetDBType() core.DbType {
	return core.SQLITE
}

func TestStoreQueriesUseProviderTables(t *testing.T) {
	registerTeamSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", teamSQLMockXormDriver{})
		}
	})

	dsn := "team-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockTeamDB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	providerCalls := 0
	dbHelper := &legacysql.LegacyDatabaseHelper{
		DB: legacyDB,
		Table: func(name string) string {
			return "test_schema." + name
		},
	}
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		providerCalls++
		return dbHelper, nil
	}
	store := &xormStore{sql: provider}
	store.RegisterDelete(func(dbHelper *legacysql.LegacyDatabaseHelper, orgID, teamID int64) (teamdelete.Query, error) {
		table, err := dbHelper.DialectForDriver().Ident(dbHelper.Table("team_group"))
		require.NoError(t, err)
		return teamdelete.Query{
			SQL:  "DELETE FROM " + table + " WHERE org_id = ? AND team_id = ?",
			Args: []any{orgID, teamID},
		}, nil
	})
	signedInUser := &user.SignedInUser{
		OrgID: 7,
		Permissions: map[int64]map[string][]string{
			7: {ac.ActionTeamsRead: {ac.ScopeTeamsAll}},
		},
	}
	teamColumns := []string{"id", "uid", "org_id", "name", "email", "external_uid", "is_provisioned", "member_count"}
	teamRow := func() *sqlmock.Rows {
		return sqlmock.NewRows(teamColumns).AddRow(int64(11), "team-a", int64(7), "Operations", "ops@example.com", "", false, int64(1))
	}

	mock.ExpectQuery(regexp.QuoteMeta(`FROM "test_schema"."team" AS team`)).
		WithArgs(int64(7)).
		WillReturnRows(teamRow())
	mock.ExpectQuery(`(?i)SELECT count\(\*\) FROM .*test_schema.*team`).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	result, err := store.Search(ctx, &team.SearchTeamsQuery{OrgID: 7, SignedInUser: signedInUser})
	require.NoError(t, err)
	require.Len(t, result.Teams, 1)

	mock.ExpectQuery(regexp.QuoteMeta(`FROM "test_schema"."team" AS team`)).
		WithArgs(int64(7), int64(11)).
		WillReturnRows(teamRow())
	gotTeam, err := store.GetByID(ctx, &team.GetTeamByIDQuery{OrgID: 7, ID: 11})
	require.NoError(t, err)
	require.Equal(t, int64(11), gotTeam.ID)

	mock.ExpectQuery(regexp.QuoteMeta(`INNER JOIN "test_schema"."team_member" AS team_member`)).
		WithArgs(int64(7), int64(42)).
		WillReturnRows(teamRow())
	teams, err := store.GetByUser(ctx, &team.GetTeamsByUserQuery{OrgID: 7, UserID: 42, SignedInUser: signedInUser})
	require.NoError(t, err)
	require.Len(t, teams, 1)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT team_member.team_id, team.uid
FROM "test_schema"."team_member" AS team_member`)).
		WithArgs(int64(42), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"team_id", "uid"}).AddRow(int64(11), "team-a"))
	ids, uids, err := store.GetIDsByUser(ctx, &team.GetTeamIDsByUserQuery{OrgID: 7, UserID: 42})
	require.NoError(t, err)
	require.Equal(t, []int64{11}, ids)
	require.Equal(t, []string{"team-a"}, uids)

	mock.ExpectQuery(regexp.QuoteMeta(`FROM "test_schema"."team_member"`)).
		WithArgs(int64(7), int64(11), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))
	isMember, err := store.IsMember(ctx, 7, 11, 42)
	require.NoError(t, err)
	require.True(t, isMember)

	mock.ExpectQuery(regexp.QuoteMeta(`FROM "test_schema"."team"
WHERE org_id = ?
  AND id = ?`)).
		WithArgs(int64(7), int64(11)).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team_member"`)).
		WithArgs(int64(7), int64(11)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team"`)).
		WithArgs(int64(7), int64(11)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."dashboard_acl"`)).
		WithArgs(int64(7), int64(11)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team_group"`)).
		WithArgs(int64(7), int64(11)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.Delete(ctx, &team.DeleteTeamCommand{OrgID: 7, ID: 11}))

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team_member"
WHERE user_id = ?`)).
		WithArgs(int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.RemoveUsersMemberships(ctx, 42))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT *
FROM "test_schema"."team_member"`)).
		WithArgs(int64(7), int64(11), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
	require.NoError(t, legacyDB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := getTeamMember(dbHelper, sess, 7, 11, 42)
		return err
	}))

	mock.ExpectQuery(regexp.QuoteMeta(`FROM "test_schema"."team"
WHERE org_id = ?
  AND id = ?`)).
		WithArgs(int64(7), int64(11)).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."team_member"
WHERE org_id = ?
  AND team_id = ?
  AND user_id = ?`)).
		WithArgs(int64(7), int64(11), int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, legacyDB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return removeTeamMember(dbHelper, sess, &team.RemoveTeamMemberCommand{OrgID: 7, TeamID: 11, UserID: 42})
	}))

	require.Equal(t, 7, providerCalls)
	require.NoError(t, mock.ExpectationsWereMet())
}
