package sql

import (
	"testing"

	"github.com/stretchr/testify/require"
)

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
			tables, err := TablesList(tc.sql)
			if tc.expectError {
				require.NotNil(t, err, "expected error for SQL: %s", tc.sql)
			} else {
				require.Nil(t, err, "unexpected error for SQL: %s", tc.sql)
				require.Equal(t, tc.expected, tables, "mismatched tables for SQL: %s", tc.sql)
			}
		})
	}
}
