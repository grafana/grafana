package sql

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractFunctionNames(t *testing.T) {
	tests := []struct {
		name    string
		sql     string
		want    []string
		wantErr bool
	}{
		{
			name: "regular FuncExpr calls are collected and sorted",
			sql:  "SELECT SUM(val), AVG(val), COUNT(*) FROM A",
			want: []string{"avg", "count", "sum"},
		},
		{
			name: "GROUP_CONCAT comes through as a GroupConcatExpr node",
			sql:  "SELECT GROUP_CONCAT(col) FROM A",
			want: []string{"group_concat"},
		},
		{
			name: "EXTRACT comes through as an ExtractFuncExpr node",
			sql:  "SELECT EXTRACT(YEAR FROM ts) FROM A",
			want: []string{"extract"},
		},
		{
			name: "TIMESTAMPDIFF comes through as a TimestampFuncExpr node",
			sql:  "SELECT TIMESTAMPDIFF(YEAR, d1, d2) FROM A",
			want: []string{"timestampdiff"},
		},
		{
			name: "TIMESTAMPADD comes through as a TimestampFuncExpr node",
			sql:  "SELECT TIMESTAMPADD(DAY, 1, d1) FROM A",
			want: []string{"timestampadd"},
		},
		{
			name: "TRIM comes through as a TrimExpr node",
			sql:  "SELECT TRIM(col) FROM A",
			want: []string{"trim"},
		},
		{
			name: "TRIM with direction comes through as a TrimExpr node",
			sql:  "SELECT TRIM(LEADING 'x' FROM col) FROM A",
			want: []string{"trim"},
		},
		{
			name: "CHAR comes through as a CharExpr node",
			sql:  "SELECT CHAR(65) FROM A",
			want: []string{"char"},
		},
		{
			name: "same function appearing multiple times is deduplicated",
			sql:  "SELECT ROUND(SUM(a), 2), ROUND(AVG(b), 2) FROM A",
			want: []string{"avg", "round", "sum"},
		},
		{
			name: "mix of FuncExpr and special node types",
			sql:  "SELECT SUM(val), GROUP_CONCAT(label), TRIM(name) FROM A",
			want: []string{"group_concat", "sum", "trim"},
		},
		{
			name: "query with no function calls returns empty slice",
			sql:  "SELECT col FROM A WHERE col > 1",
			want: []string{},
		},
		{
			name: "function names are lower-cased regardless of input case",
			sql:  "SELECT SuM(val), AvG(val) FROM A",
			want: []string{"avg", "sum"},
		},
		{
			name: "CAST comes through as a ConvertExpr node",
			sql:  "SELECT CAST(col AS UNSIGNED) FROM A",
			want: []string{"cast"},
		},
		{
			name: "CONVERT comes through as a ConvertExpr node",
			sql:  "SELECT CONVERT(col, CHAR) FROM A",
			want: []string{"convert"},
		},
		{
			name:    "invalid SQL returns an error",
			sql:     "SELECT * FROM zzz aaa zzz",
			wantErr: true,
		},
		{
			name: "blocked function name is still collected",
			sql:  "SELECT SLEEP(1) FROM A",
			want: []string{"sleep"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ExtractFunctionNames(tc.sql)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tc.want == nil {
				tc.want = []string{}
			}
			require.Equal(t, tc.want, got)
		})
	}
}

func TestTablesList(t *testing.T) {
	tests := []struct {
		name        string
		sql         string
		expected    []string
		expectError bool
	}{
		{
			name:     "simple select",
			sql:      "select * from foo",
			expected: []string{"foo"},
		},
		{
			name:     "select with comma",
			sql:      "select * from foo,bar",
			expected: []string{"bar", "foo"},
		},
		{
			name:     "select with multiple commas",
			sql:      "select * from foo,bar,baz",
			expected: []string{"bar", "baz", "foo"},
		},
		{
			name:     "no table",
			sql:      "select 1 as 'n'",
			expected: []string{},
		},
		{
			name:     "json array",
			sql:      "SELECT JSON_ARRAY(1, 2, 3) AS array_value",
			expected: []string{},
		},
		{
			name:     "json extract",
			sql:      "SELECT JSON_EXTRACT(JSON_ARRAY(1, 2, 3), '$[0]') AS first_element;",
			expected: []string{},
		},
		{
			name:     "json int array",
			sql:      "SELECT JSON_ARRAY(3, 2, 1) AS int_array;",
			expected: []string{},
		},
		{
			name:     "subquery",
			sql:      "select * from (select * from people limit 1) AS subquery",
			expected: []string{"people"},
		},
		{
			name: "join",
			sql: `select * from A
			JOIN B ON A.name = B.name
			LIMIT 10`,
			expected: []string{"A", "B"},
		},
		{
			name: "right join",
			sql: `select * from A
			RIGHT JOIN B ON A.name = B.name
			LIMIT 10`,
			expected: []string{"A", "B"},
		},
		{
			name: "alias with join",
			sql: `select * from A as X
			RIGHT JOIN B ON A.name = X.name
			LIMIT 10`,
			expected: []string{"A", "B"},
		},
		{
			name:     "alias",
			sql:      "select * from A as X LIMIT 10",
			expected: []string{"A"},
		},
		{
			name:        "error case",
			sql:         "select * from zzz aaa zzz",
			expectError: true,
		},
		{
			name: "parens",
			sql: `SELECT  t1.Col1,
				t2.Col1,
				t3.Col1
			FROM    table1 AS t1
			LEFT JOIN	(
				table2 AS t2
				INNER JOIN table3 AS t3 ON t3.Col1 = t2.Col1
			) ON t2.Col1 = t1.Col1;`,
			expected: []string{"table1", "table2", "table3"},
		},
		{
			name: "with clause",
			sql: `WITH top_products AS (
				SELECT * FROM products
				ORDER BY price DESC
				LIMIT 5
			)
			SELECT name, price
			FROM top_products;`,
			expected: []string{"products"},
		},
		{
			name:     "with quote",
			sql:      "select *,'junk' from foo",
			expected: []string{"foo"},
		},
		{
			name:     "with quote 2",
			sql:      "SELECT json_serialize_sql('SELECT 1')",
			expected: []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tables, err := TablesList(t.Context(), tc.sql)
			if tc.expectError {
				require.NotNil(t, err, "expected error for SQL: %s", tc.sql)
			} else {
				require.Nil(t, err, "unexpected error for SQL: %s", tc.sql)
				require.Equal(t, tc.expected, tables, "mismatched tables for SQL: %s", tc.sql)
			}
		})
	}
}
