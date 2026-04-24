package sql

import (
	"fmt"
	"testing"
)

// TestRedactedQuery_DemoOutput is here to make it easy for reviewers to see
// what the redactor produces for a representative set of inputs. It always
// passes — the goal is to print the before/after pairs so we can paste them
// into the PR description and the analytics design doc.
func TestRedactedQuery_DemoOutput(t *testing.T) {
	queries := []string{
		`SELECT email, ssn FROM customers WHERE country = 'US' AND age > 18`,
		`SELECT u.country, COUNT(*) AS total
			FROM users u
			LEFT JOIN orders o ON u.id = o.user_id
			WHERE u.email LIKE '%@example.com'
			GROUP BY u.country
			HAVING COUNT(*) > 10
			ORDER BY total DESC LIMIT 5`,
		`WITH top_products AS (
			SELECT id, price FROM products WHERE price > 100
			ORDER BY price DESC LIMIT 5
		)
		SELECT id FROM top_products`,
		`SELECT user_id,
			ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ts DESC) AS rn
			FROM events
			WHERE region IN ('us-east', 'us-west', 'eu-west')`,
		`SELECT CASE WHEN amount > 100 THEN 'high' ELSE 'low' END AS bucket
			FROM transactions`,
	}

	for _, q := range queries {
		out, err := RedactedQuery(q)
		if err != nil {
			t.Fatalf("redact failed: %v", err)
		}
		fmt.Println("--- ORIGINAL ---")
		fmt.Println(q)
		fmt.Println("--- REDACTED ---")
		fmt.Println(out)
		fmt.Println()
	}
}
