package migrator

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

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

const boolTestTableName = "bool_test"

var boolTestTable = Table{
	Name: boolTestTableName,
	Columns: []*Column{
		{Name: "id", Type: DB_Int, IsPrimaryKey: true, IsAutoIncrement: true},
		{Name: "name", Type: DB_Text},
		{Name: "value", Type: DB_Bool},
	},
}

func setupTestDB(t *testing.T) (Dialect, *xorm.Engine) {
	t.Helper()
	dbType := sqlutil.GetTestDBType()
	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			fmt.Printf("failed to close xorm engine: %v", err)
		}
	})

	exists, err := x.IsTableExist(boolTestTableName)
	require.NoError(t, err)

	d := NewDialect(testDB.DriverName)
	if !exists {
		_, err := x.Exec(NewAddTableMigration(boolTestTable).SQL(d))
		require.NoError(t, err)
	} else {
		_, err := x.Exec("DELETE FROM " + boolTestTableName + " WHERE true")
		require.NoError(t, err)
	}

	return d, x
}

func TestIntegration_Dialect(t *testing.T) {
	d, x := setupTestDB(t)

	t.Run("bool values", func(t *testing.T) {
		tv := &BoolTest{Name: "true value", Value: true}
		_, err := x.Insert(tv)
		require.NoError(t, err)

		fv := &BoolTest{Name: "false value", Value: false}
		_, err = x.Insert(fv)
		require.NoError(t, err)

		var found []*BoolTest
		require.NoError(t, x.Where("value = ?", d.BooleanValue(true)).Find(&found))
		require.Len(t, found, 1)
		require.True(t, found[0].Value)
		require.Equal(t, tv.ID, found[0].ID)

		found = nil
		require.NoError(t, x.Where("value = ?", d.BooleanValue(false)).Find(&found))
		require.Len(t, found, 1)
		require.False(t, found[0].Value)
		require.Equal(t, fv.ID, found[0].ID)
	})
}

type BoolTest struct {
	ID    int `xorm:"pk autoincr 'id'"`
	Name  string
	Value bool
}
