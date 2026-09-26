package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPostgresDialectSQLType(t *testing.T) {
	db := NewPostgresDialect()

	tests := []struct {
		name     string
		col      *Column
		expected string
	}{
		{
			name:     "DB_BigInt with AutoIncrement should produce BIGSERIAL, not SERIAL",
			col:      &Column{Type: DB_BigInt, IsAutoIncrement: true},
			expected: DB_BigSerial,
		},
		{
			name:     "DB_BigInt without AutoIncrement should produce BIGINT",
			col:      &Column{Type: DB_BigInt, IsAutoIncrement: false},
			expected: DB_BigInt,
		},
		{
			name:     "DB_Int with AutoIncrement should still produce SERIAL",
			col:      &Column{Type: DB_Int, IsAutoIncrement: true},
			expected: DB_Serial,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := db.SQLType(tc.col)
			require.Equal(t, tc.expected, result)
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
