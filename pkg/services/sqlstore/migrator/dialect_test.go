package migrator

import (
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"
)

func TestPostgresDialectErrors(t *testing.T) {
	dialect := &PostgresDialect{}

	uniqueErr := fmt.Errorf("insert: %w", &pgconn.PgError{Code: "23505", Message: "duplicate key"})
	require.True(t, dialect.IsUniqueConstraintViolation(uniqueErr))
	require.Equal(t, "duplicate key", dialect.ErrorMessage(uniqueErr))

	deadlockErr := &pgconn.PgError{Code: "40P01", Message: "deadlock detected"}
	require.True(t, dialect.IsDeadlock(deadlockErr))
}

func TestPostgresDialectGetDBName(t *testing.T) {
	dialect := &PostgresDialect{}

	for _, tc := range []struct {
		name string
		dsn  string
		want string
	}{
		{name: "keyword DSN", dsn: "host=localhost dbname=grafana user=grafana", want: "grafana"},
		{name: "URL DSN", dsn: "postgres://grafana:secret@localhost:5432/grafana-test?sslmode=disable", want: "grafana-test"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := dialect.GetDBName(tc.dsn)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestInsertQuery(t *testing.T) {
	tests := []struct {
		name                  string
		tableName             string
		values                map[string]any
		expectedErr           bool
		expectedPostgresQuery string
		expectedPostgresArgs  []any
		expectedMySQLQuery    string
		expectedMySQLArgs     []any
		expectedSQLiteQuery   string
		expectedSQLiteArgs    []any
	}{
		{
			"insert one",
			"some_table",
			map[string]any{"col1": "val1", "col2": "val2", "col3": "val3"},
			false,
			"INSERT INTO \"some_table\" (\"col1\", \"col2\", \"col3\") VALUES (?, ?, ?)",
			[]any{"val1", "val2", "val3"},
			"INSERT INTO `some_table` (`col1`, `col2`, `col3`) VALUES (?, ?, ?)",
			[]any{"val1", "val2", "val3"},
			"INSERT INTO `some_table` (`col1`, `col2`, `col3`) VALUES (?, ?, ?)",
			[]any{"val1", "val2", "val3"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var db Dialect
			db = NewPostgresDialect()
			q, args, err := db.InsertQuery(tc.tableName, tc.values)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedPostgresQuery, q, "Postgres query incorrect")
			require.Equal(t, tc.expectedPostgresArgs, args, "Postgres args incorrect")

			db = NewMysqlDialect()
			q, args, err = db.InsertQuery(tc.tableName, tc.values)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedMySQLQuery, q, "MySQL query incorrect")
			require.Equal(t, tc.expectedMySQLArgs, args, "MySQL args incorrect")

			db = NewSQLite3Dialect()
			q, args, err = db.InsertQuery(tc.tableName, tc.values)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedSQLiteQuery, q, "SQLite query incorrect")
			require.Equal(t, tc.expectedSQLiteArgs, args, "SQLite args incorrect")
		})
	}
}

func TestUpdateQuery(t *testing.T) {
	tests := []struct {
		name                  string
		tableName             string
		values                map[string]any
		where                 map[string]any
		expectedErr           bool
		expectedPostgresQuery string
		expectedPostgresArgs  []any
		expectedMySQLQuery    string
		expectedMySQLArgs     []any
		expectedSQLiteQuery   string
		expectedSQLiteArgs    []any
	}{
		{
			"insert one",
			"some_table",
			map[string]any{"col1": "val1", "col2": "val2", "col3": "val3"},
			map[string]any{"key1": 10},
			false,
			"UPDATE \"some_table\" SET \"col1\"=?, \"col2\"=?, \"col3\"=? WHERE \"key1\"=?",
			[]any{"val1", "val2", "val3", 10},
			"UPDATE `some_table` SET `col1`=?, `col2`=?, `col3`=? WHERE `key1`=?",
			[]any{"val1", "val2", "val3", 10},
			"UPDATE `some_table` SET `col1`=?, `col2`=?, `col3`=? WHERE `key1`=?",
			[]any{"val1", "val2", "val3", 10},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var db Dialect
			db = NewPostgresDialect()
			q, args, err := db.UpdateQuery(tc.tableName, tc.values, tc.where)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedPostgresQuery, q, "Postgres query incorrect")
			require.Equal(t, tc.expectedPostgresArgs, args, "Postgres args incorrect")

			db = NewMysqlDialect()
			q, args, err = db.UpdateQuery(tc.tableName, tc.values, tc.where)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedMySQLQuery, q, "MySQL query incorrect")
			require.Equal(t, tc.expectedMySQLArgs, args, "MySQL args incorrect")

			db = NewSQLite3Dialect()
			q, args, err = db.UpdateQuery(tc.tableName, tc.values, tc.where)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedSQLiteQuery, q, "SQLite query incorrect")
			require.Equal(t, tc.expectedSQLiteArgs, args, "SQLite args incorrect")
		})
	}
}
