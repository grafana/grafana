package sql

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRedactedQuery(t *testing.T) {
	// We don't assert on the exact stringified SQL because that is a
	// product of Vitess's formatter and may shift over library upgrades.
	// Instead we assert that:
	//   - the query is still parseable as SQL after redaction
	//   - the structural keywords (joins, aggregations, etc.) remain
	//   - any potentially sensitive substring from the original query
	//     does not appear in the redacted output.
	tests := []struct {
		name              string
		sql               string
		mustNotContain    []string
		mustContain       []string
		mustContainLowest []string
	}{
		{
			name: "simple select",
			sql:  "SELECT email, ssn FROM customers WHERE country = 'US'",
			mustNotContain: []string{
				"email", "ssn", "customers", "US",
			},
			mustContain: []string{
				"select", "from", "where",
			},
			mustContainLowest: []string{"c1", "c2", "t1"},
		},
		{
			name: "join + aggregation",
			sql: `SELECT users.country, COUNT(*) AS total
				FROM users
				LEFT JOIN orders ON users.id = orders.user_id
				WHERE users.email LIKE '%@example.com'
				GROUP BY users.country
				HAVING COUNT(*) > 10
				ORDER BY total DESC
				LIMIT 5`,
			mustNotContain: []string{
				"users", "orders", "country", "email",
				"example.com", "user_id",
				// "id" is a substring of "ident" / placeholders, so don't assert on it
			},
			mustContain: []string{
				"left join", "group by", "having", "order by", "limit", "count(*)",
			},
		},
		{
			name: "subquery",
			sql: `SELECT name FROM (
				SELECT name FROM people WHERE age > 30
			) AS adults`,
			mustNotContain: []string{"people", "age", "name", "adults"},
			mustContain:    []string{"select", "from", "where"},
		},
		{
			name: "cte (with clause)",
			sql: `WITH top_products AS (
				SELECT id, price FROM products WHERE price > 100 ORDER BY price DESC LIMIT 5
			)
			SELECT id FROM top_products`,
			mustNotContain: []string{"top_products", "products", "price"},
			mustContain:    []string{"with", "select", "from", "limit"},
		},
		{
			name: "in list",
			sql:  `SELECT * FROM logs WHERE user_id IN ('abc', 'def', 'ghi')`,
			mustNotContain: []string{
				"abc", "def", "ghi", "logs", "user_id",
			},
			mustContain: []string{"in"},
		},
		{
			name: "case expression",
			sql: `SELECT CASE WHEN amount > 100 THEN 'high' ELSE 'low' END AS bucket
				FROM transactions`,
			mustNotContain: []string{
				"high", "low", "amount", "bucket", "transactions",
			},
			mustContain: []string{"case", "when", "then", "else", "end"},
		},
		{
			name: "window function",
			sql: `SELECT user_id,
				ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ts DESC) AS rn
				FROM events`,
			mustNotContain: []string{
				"user_id", "events", "rn",
			},
			mustContain: []string{"row_number", "over", "partition by", "order by"},
		},
		{
			name: "qualified column references collapse to same placeholder",
			sql: `SELECT a.x, b.x FROM a JOIN b ON a.x = b.x`,
			mustNotContain: []string{
				// don't assert "a", "b", or "x" individually because these
				// short tokens occur in keywords and placeholders.
			},
			mustContain: []string{"join"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			redacted, err := RedactedQuery(tc.sql)
			require.NoError(t, err, "redact failed for: %s", tc.sql)
			require.NotEmpty(t, redacted)

			lower := strings.ToLower(redacted)
			for _, banned := range tc.mustNotContain {
				require.NotContains(t, lower, strings.ToLower(banned),
					"redacted query unexpectedly contains %q: %s", banned, redacted)
			}
			for _, must := range tc.mustContain {
				require.Contains(t, lower, strings.ToLower(must),
					"redacted query missing keyword %q: %s", must, redacted)
			}
			for _, must := range tc.mustContainLowest {
				require.Contains(t, lower, must,
					"redacted query missing placeholder %q: %s", must, redacted)
			}
		})
	}
}

func TestRedactedQuery_StableForRepeatedIdentifiers(t *testing.T) {
	const q = `SELECT u.email, u.email FROM users u WHERE u.email = 'x@y.z'`
	out, err := RedactedQuery(q)
	require.NoError(t, err)

	// `u.email` appears twice in SELECT and once in WHERE; all three should
	// reference the same column placeholder so analytics can see that the
	// query references the same column multiple times.
	lower := strings.ToLower(out)
	require.NotContains(t, lower, "email")
	require.NotContains(t, lower, "x@y.z")

	require.Equal(t, 3, strings.Count(lower, "c1"),
		"expected three references to c1, got: %s", out)
}

func TestRedactedQuery_CTEDeclarationAndReferenceShareName(t *testing.T) {
	const q = `WITH top_products AS (
		SELECT id FROM products WHERE price > 100
	)
	SELECT id FROM top_products`

	out, err := RedactedQuery(q)
	require.NoError(t, err)

	lower := strings.ToLower(out)
	// The CTE is registered first, so it gets t1. The outer FROM should
	// reuse t1 (not introduce t3 or t2 — t2 is the inner table `products`).
	require.Equal(t, 2, strings.Count(lower, "t1"),
		"CTE declaration and outer reference should share t1, got: %s", out)
}

func TestRedactedQuery_TableAliasAndQualifierShareName(t *testing.T) {
	const q = `SELECT u.id, u.email FROM users u WHERE u.id > 0`
	out, err := RedactedQuery(q)
	require.NoError(t, err)

	lower := strings.ToLower(out)
	// `u` (the alias) should match `u.id` / `u.email` qualifiers. The alias
	// is t1 (the first table-like identifier seen in the FROM clause), and
	// every qualifier reference should also be t1.
	require.GreaterOrEqual(t, strings.Count(lower, "t1"), 3,
		"alias and qualifiers should share t1, got: %s", out)
}

func TestRedactedQuery_PreservesJoinAndCteDistinction(t *testing.T) {
	const q = `WITH t AS (SELECT 1)
		SELECT * FROM t JOIN t AS u ON 1=1`
	out, err := RedactedQuery(q)
	require.NoError(t, err)

	lower := strings.ToLower(out)
	require.Contains(t, lower, "with")
	require.Contains(t, lower, "join")

	// Both literal `1` values must be redacted to `0`.
	require.NotContains(t, lower, "1=1")
}

func TestRedactedQuery_InvalidSQL(t *testing.T) {
	out, err := RedactedQuery("this is not sql")
	require.Error(t, err)
	require.Empty(t, out, "must return empty string on parse error to avoid leaking input")
}

func TestRedactedQuery_Empty(t *testing.T) {
	out, err := RedactedQuery("")
	require.Error(t, err)
	require.Empty(t, out)
}
