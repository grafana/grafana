package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpsertMultiple(t *testing.T) {
	tests := []struct {
		name                  string
		keyCols               []string
		updateCols            []string
		count                 int
		expectedErr           bool
		expectedPostgresQuery string
		expectedMySQLQuery    string
		expectedSQLiteQuery   string
	}{
		{
			"upsert one",
			[]string{"key1", "key2"},
			[]string{"key1", "key2", "val1", "val2"},
			1,
			false,
			"INSERT INTO test_table (\"key1\", \"key2\", \"val1\", \"val2\") VALUES ($1, $2, $3, $4) ON CONFLICT (\"key1\", \"key2\") DO UPDATE SET \"key1\"=EXCLUDED.\"key1\", \"key2\"=EXCLUDED.\"key2\", \"val1\"=EXCLUDED.\"val1\", \"val2\"=EXCLUDED.\"val2\";",
			"INSERT INTO test_table (`key1`, `key2`, `val1`, `val2`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `key1`=VALUES(`key1`), `key2`=VALUES(`key2`), `val1`=VALUES(`val1`), `val2`=VALUES(`val2`)",
			"INSERT INTO test_table (`key1`, `key2`, `val1`, `val2`) VALUES (?, ?, ?, ?) ON CONFLICT(`key1`, `key2`) DO UPDATE SET `key1`=excluded.`key1`, `key2`=excluded.`key2`, `val1`=excluded.`val1`, `val2`=excluded.`val2`",
		},
		{
			"upsert two",
			[]string{"key1", "key2"},
			[]string{"key1", "key2", "val1", "val2"},
			2,
			false,
			"INSERT INTO test_table (\"key1\", \"key2\", \"val1\", \"val2\") VALUES ($1, $2, $3, $4), ($5, $6, $7, $8) ON CONFLICT (\"key1\", \"key2\") DO UPDATE SET \"key1\"=EXCLUDED.\"key1\", \"key2\"=EXCLUDED.\"key2\", \"val1\"=EXCLUDED.\"val1\", \"val2\"=EXCLUDED.\"val2\";",
			"INSERT INTO test_table (`key1`, `key2`, `val1`, `val2`) VALUES (?, ?, ?, ?), (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `key1`=VALUES(`key1`), `key2`=VALUES(`key2`), `val1`=VALUES(`val1`), `val2`=VALUES(`val2`)",
			"INSERT INTO test_table (`key1`, `key2`, `val1`, `val2`) VALUES (?, ?, ?, ?), (?, ?, ?, ?) ON CONFLICT(`key1`, `key2`) DO UPDATE SET `key1`=excluded.`key1`, `key2`=excluded.`key2`, `val1`=excluded.`val1`, `val2`=excluded.`val2`",
		},
		{
			"count error",
			[]string{"key1", "key2"},
			[]string{"key1", "key2", "val1", "val2"},
			0,
			true,
			"",
			"",
			"",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var db Dialect
			db = &PostgresDialect{}
			q, err := db.UpsertMultipleSQL("test_table", tc.keyCols, tc.updateCols, tc.count)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedPostgresQuery, q, "Postgres query incorrect")

			db = &MySQLDialect{}
			q, err = db.UpsertMultipleSQL("test_table", tc.keyCols, tc.updateCols, tc.count)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedMySQLQuery, q, "MySQL query incorrect")

			db = &SQLite3{}
			q, err = db.UpsertMultipleSQL("test_table", tc.keyCols, tc.updateCols, tc.count)

			require.True(t, (err != nil) == tc.expectedErr)
			require.Equal(t, tc.expectedSQLiteQuery, q, "SQLite query incorrect")
		})
	}
}
