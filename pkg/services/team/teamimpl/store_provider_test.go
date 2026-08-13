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

func (d *sqlmockTeamDB) GetDBType() core.DbType {
	return core.SQLITE
}

func TestStoreReadQueriesUseProviderTables(t *testing.T) {
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
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		providerCalls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				return "test_schema." + name
			},
		}, nil
	}
	store := &xormStore{sql: provider}
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

	require.Equal(t, 5, providerCalls)
	require.NoError(t, mock.ExpectationsWereMet())
}
