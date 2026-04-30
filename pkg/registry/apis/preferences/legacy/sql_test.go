package legacy

import (
	"context"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	infradb "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// testDB wraps FakeDB but returns a real SessionDB backed by sqlmock.
type testDB struct {
	dbtest.FakeDB
	sess *session.SessionDB
}

func (t *testDB) GetSqlxSession() *session.SessionDB {
	return t.sess
}

var _ infradb.DB = (*testDB)(nil)

func newTestLegacySQL(t *testing.T) (*LegacySQL, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	sess := session.GetSession(sqlxDB)
	helper := &legacysql.LegacyDatabaseHelper{
		DB:    &testDB{sess: sess},
		Table: func(n string) string { return n },
	}

	store := &LegacySQL{db: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return helper, nil
	}}
	return store, mock
}

func TestGetLegacyTeamID(t *testing.T) {
	store, mock := newTestLegacySQL(t)

	mock.ExpectQuery("SELECT id FROM team").
		WithArgs(int64(1), "ffj1xdbwxf6kga").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(42)))

	id, err := store.getLegacyTeamID(context.Background(), 1, "ffj1xdbwxf6kga")
	require.NoError(t, err)
	require.Equal(t, int64(42), id)
	require.NoError(t, mock.ExpectationsWereMet())
}
