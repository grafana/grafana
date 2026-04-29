package prometheus

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractMetrics(t *testing.T) {
	parser := NewParser()

	tests := []struct {
		name          string
		query         string
		expected      []string
		expectError   bool
		errorContains string
	}{
		// Category 1: Basic Extraction (3 tests - covers AST node types)
		{
			name:     "simple metric",
			query:    "up",
			expected: []string{"up"},
		},
		{
			name:     "metric with labels",
			query:    `up{job="api"}`,
			expected: []string{"up"},
		},
		{
			name:     "range selector",
			query:    "up[5m]",
			expected: []string{"up"},
		},

		// Category 2: Function Composition (2 tests - nested complexity)
		{
			name:     "single function",
			query:    "rate(http_requests_total[5m])",
			expected: []string{"http_requests_total"},
		},
		{
			name:     "nested functions",
			query:    "sum(rate(requests[5m]))",
			expected: []string{"requests"},
		},

		// Category 3: Binary Operations (2 tests - multiple metrics)
		{
			name:     "two metrics",
			query:    "metric_a + metric_b",
			expected: []string{"metric_a", "metric_b"},
		},
		{
			name:     "three metrics nested",
			query:    "(a + b) / c",
			expected: []string{"a", "b", "c"},
		},

		// Category 4: Deduplication (1 test - critical behavior)
		{
			name:     "duplicate metric",
			query:    "up + up",
			expected: []string{"up"},
		},

		// Category 5: Edge Cases (2 tests - boundary behaviors)
		{
			name:     "no metrics (literals only)",
			query:    "1 + 1",
			expected: []string{},
		},
		{
			name:     "built-in function without metric",
			query:    "time()",
			expected: []string{},
		},
		{
			name:     "comparison operator",
			query:    "a > 5",
			expected: []string{"a"},
		},

		// Category 6: Real Dashboard Patterns (3 tests - production queries)
		{
			name:     "binary op with function and labels",
			query:    `(time() - process_start_time_seconds{job="prometheus", instance=~"$node"})`,
			expected: []string{"process_start_time_seconds"},
		},
		{
			name:     "rate with regex label matcher",
			query:    `rate(prometheus_local_storage_ingested_samples_total{instance=~"$node"}[5m])`,
			expected: []string{"prometheus_local_storage_ingested_samples_total"},
		},
		{
			name:     "metric with negation and multiple labels",
			query:    `prometheus_target_interval_length_seconds{quantile!="0.01", quantile!="0.05", instance=~"$node"}`,
			expected: []string{"prometheus_target_interval_length_seconds"},
		},

		// Category 7: Error Handling (2 tests - validation)
		{
			name:          "empty string",
			query:         "",
			expectError:   true,
			errorContains: "parse",
		},
		{
			name:          "malformed expression",
			query:         "{{invalid}}",
			expectError:   true,
			errorContains: "parse",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parser.ExtractMetrics(tt.query)

			// Check error expectation
			if tt.expectError {
				require.Error(t, err, "Expected error for query: %q", tt.query)
				if tt.errorContains != "" {
					require.ErrorContains(t, err, tt.errorContains,
						"Error should contain %q for query: %q", tt.errorContains, tt.query)
				}
				return
			}

			require.NoError(t, err, "Unexpected error for query: %q", tt.query)

			// Check result matches expected (order-independent for multiple metrics)
			require.ElementsMatch(t, tt.expected, result,
				"ExtractMetrics(%q) returned unexpected metrics", tt.query)
		})
	}
}
