package legacy

import (
	"context"
	"errors"
	"testing"
	"text/template"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"

	infradb "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
)

// testDB wraps FakeDB but returns a real SessionDB backed by sqlmock.
type testDB struct {
	dbtest.FakeDB
	sess *session.SessionDB
}

func (t *testDB) GetSqlxSession() *session.SessionDB {
	return t.sess
}

// Ensure testDB implements db.DB.
var _ infradb.DB = (*testDB)(nil)

// usersColumns matches the columns selected in users_query.sql.
var usersColumns = []string{
	"org_id", "id", "uid", "login", "email", "name",
	"created", "updated", "is_service_account", "is_disabled", "is_admin", "email_verified",
	"is_provisioned", "last_seen_at", "role",
}

// trivialTemplate is a simple template that queryUsers can execute.
var trivialTemplate = template.Must(template.New("test").Parse("SELECT 1"))

// trivialArgs satisfies sqltemplate.Args for the trivial template.
type trivialArgs struct {
	sqltemplate.SQLTemplate
}

func (t trivialArgs) Validate() error { return nil }

func newTestHelper(mockDB *testDB) *legacysql.LegacyDatabaseHelper {
	return &legacysql.LegacyDatabaseHelper{
		DB: mockDB,
		Table: func(n string) string {
			return n
		},
	}
}

func TestQueryUsers_NullEmailVerified(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close() //nolint:errcheck

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	sess := session.GetSession(sqlxDB)
	mockDB := &testDB{sess: sess}
	helper := newTestHelper(mockDB)

	now := time.Now()
	rows := sqlmock.NewRows(usersColumns).AddRow(
		1, 100, "uid1", "admin", "admin@example.com", "Admin",
		now, now, false, false, true, nil, // nil for email_verified
		false, now, "Admin",
	)
	mock.ExpectQuery("SELECT 1").WillReturnRows(rows)

	store := &legacySQLStore{}
	args := trivialArgs{SQLTemplate: mocks.NewTestingSQLTemplate()}
	res, err := store.queryUsers(context.Background(), helper, trivialTemplate, &args, 100)
	require.NoError(t, err)
	require.Len(t, res.Items, 1)
	require.False(t, res.Items[0].EmailVerified)
}

func TestQueryUsers_EmailVerifiedTrue(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close() //nolint:errcheck

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	sess := session.GetSession(sqlxDB)
	mockDB := &testDB{sess: sess}
	helper := newTestHelper(mockDB)

	now := time.Now()
	rows := sqlmock.NewRows(usersColumns).AddRow(
		1, 100, "uid1", "admin", "admin@example.com", "Admin",
		now, now, false, false, true, true, // true for email_verified
		false, now, "Admin",
	)
	mock.ExpectQuery("SELECT 1").WillReturnRows(rows)

	store := &legacySQLStore{}
	args := trivialArgs{SQLTemplate: mocks.NewTestingSQLTemplate()}
	res, err := store.queryUsers(context.Background(), helper, trivialTemplate, &args, 100)
	require.NoError(t, err)
	require.Len(t, res.Items, 1)
	require.True(t, res.Items[0].EmailVerified)
}

func TestQueryUsers_RowError(t *testing.T) {
	for _, tc := range []struct {
		name     string
		rowIndex int
	}{
		{name: "before first row", rowIndex: 0},
		{name: "after partial results", rowIndex: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close() //nolint:errcheck

			sess := session.GetSession(sqlx.NewDb(db, "sqlmock"))
			helper := newTestHelper(&testDB{sess: sess})
			now := time.Now()
			rows := sqlmock.NewRows(usersColumns)
			for i := 0; i <= tc.rowIndex; i++ {
				rows.AddRow(1, 100+i, "uid", "login", "email@example.com", "Name",
					now, now, false, false, false, true, false, now, "Viewer")
			}
			rowErr := errors.New("row iteration failed")
			rows.RowError(tc.rowIndex, rowErr)
			mock.ExpectQuery("SELECT 1").WillReturnRows(rows)

			store := &legacySQLStore{}
			args := trivialArgs{SQLTemplate: mocks.NewTestingSQLTemplate()}
			res, err := store.queryUsers(context.Background(), helper, trivialTemplate, &args, 100)
			require.NotNil(t, res)
			require.Len(t, res.Items, tc.rowIndex)
			require.ErrorIs(t, err, rowErr)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}
