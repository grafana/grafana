package azuremonitor

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	schemas "github.com/grafana/schemads"
	"github.com/stretchr/testify/require"
)

func TestBuildKQLFromSQLQuery(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	t.Run("basic table with time range only", func(t *testing.T) {
		kql := buildKQLFromSQLQuery("Heartbeat", nil, nil, nil, nil, tr)
		require.Equal(t, "Heartbeat\n"+
			"| where TimeGenerated >= datetime(2024-01-01T00:00:00Z) and TimeGenerated <= datetime(2024-01-02T00:00:00Z)", kql)
	})

	t.Run("with column projection", func(t *testing.T) {
		kql := buildKQLFromSQLQuery("Heartbeat", nil, []string{"Computer", "OSType"}, nil, nil, tr)
		require.Contains(t, kql, "| project Computer, OSType")
	})

	t.Run("with order by", func(t *testing.T) {
		orderBy := []schemas.OrderByColumn{
			{Name: "TimeGenerated", Desc: true},
			{Name: "Computer", Desc: false},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", nil, nil, orderBy, nil, tr)
		require.Contains(t, kql, "| order by TimeGenerated desc, Computer asc")
	})

	t.Run("with limit", func(t *testing.T) {
		limit := int64(100)
		kql := buildKQLFromSQLQuery("Heartbeat", nil, nil, nil, &limit, tr)
		require.Contains(t, kql, "| take 100")
	})

	t.Run("with equality filter", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "Computer",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "server01"},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		require.Contains(t, kql, "| where Computer == 'server01'")
	})

	t.Run("with not-equals filter", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "OSType",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorNotEquals, Value: "Windows"},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		require.Contains(t, kql, "| where OSType != 'Windows'")
	})

	t.Run("with greater-than filter on numeric", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "CounterValue",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorGreaterThan, Value: float64(50)},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Perf", filters, nil, nil, nil, tr)
		require.Contains(t, kql, "| where CounterValue > 50")
	})

	t.Run("with like filter (contains)", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "Computer",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorLike, Value: "prod"},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		require.Contains(t, kql, "| where Computer contains 'prod'")
	})

	t.Run("with in filter", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "OSType",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorIn, Values: []any{"Linux", "Windows"}},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		require.Contains(t, kql, "| where OSType in ('Linux', 'Windows')")
	})

	t.Run("TimeGenerated filters are skipped", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "TimeGenerated",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorGreaterThan, Value: "2024-01-01"},
				},
			},
			{
				Name: "Computer",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "srv1"},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		// Should have the auto time range but no extra TimeGenerated filter
		lines := splitKQLLines(kql)
		timeFilterCount := 0
		for _, line := range lines {
			if contains(line, "TimeGenerated") {
				timeFilterCount++
			}
		}
		require.Equal(t, 1, timeFilterCount, "only the auto-generated time filter")
		require.Contains(t, kql, "Computer == 'srv1'")
	})

	t.Run("full query with all clauses", func(t *testing.T) {
		limit := int64(50)
		filters := []schemas.ColumnFilter{
			{
				Name: "Computer",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "server01"},
				},
			},
		}
		orderBy := []schemas.OrderByColumn{{Name: "TimeGenerated", Desc: true}}
		columns := []string{"TimeGenerated", "Computer", "OSType"}

		kql := buildKQLFromSQLQuery("Heartbeat", filters, columns, orderBy, &limit, tr)

		require.Contains(t, kql, "Heartbeat\n")
		require.Contains(t, kql, "| where TimeGenerated >= datetime(")
		require.Contains(t, kql, "| where Computer == 'server01'")
		require.Contains(t, kql, "| project TimeGenerated, Computer, OSType")
		require.Contains(t, kql, "| order by TimeGenerated desc")
		require.Contains(t, kql, "| take 50")
	})

	t.Run("special characters in string values are escaped", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "Computer",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "it's-a-test"},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		require.Contains(t, kql, "Computer == 'it\\'s-a-test'")
	})

	t.Run("empty in filter is skipped", func(t *testing.T) {
		filters := []schemas.ColumnFilter{
			{
				Name: "Computer",
				Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorIn, Values: []any{}},
				},
			},
		}
		kql := buildKQLFromSQLQuery("Heartbeat", filters, nil, nil, nil, tr)
		require.NotContains(t, kql, "Computer in")
	})
}

func TestKqlLiteral(t *testing.T) {
	t.Run("string", func(t *testing.T) {
		require.Equal(t, "'hello'", kqlLiteral("hello"))
	})
	t.Run("string with quote", func(t *testing.T) {
		require.Equal(t, "'it\\'s'", kqlLiteral("it's"))
	})
	t.Run("integer float64", func(t *testing.T) {
		require.Equal(t, "42", kqlLiteral(float64(42)))
	})
	t.Run("fractional float64", func(t *testing.T) {
		require.Equal(t, "3.14", kqlLiteral(float64(3.14)))
	})
	t.Run("boolean true", func(t *testing.T) {
		require.Equal(t, "true", kqlLiteral(true))
	})
	t.Run("boolean false", func(t *testing.T) {
		require.Equal(t, "false", kqlLiteral(false))
	})
	t.Run("nil", func(t *testing.T) {
		require.Equal(t, "''", kqlLiteral(nil))
	})
}

func splitKQLLines(kql string) []string {
	var lines []string
	for _, l := range split(kql) {
		lines = append(lines, l)
	}
	return lines
}

func split(s string) []string {
	var result []string
	start := 0
	for i := range s {
		if s[i] == '\n' {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		result = append(result, s[start:])
	}
	return result
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchSubstr(s, substr)
}

func searchSubstr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
