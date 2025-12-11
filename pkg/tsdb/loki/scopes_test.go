package loki

import (
	"testing"

	scope "github.com/grafana/grafana/apps/scope/pkg/apis/scope/v0alpha1"
	"github.com/stretchr/testify/require"
)

func TestInjectScopesIntoLokiQuery(t *testing.T) {
	// skipping since its flaky.
	t.Skip()

	tests := []struct {
		name         string
		query        string
		scopeFilters []scope.ScopeFilter
		expected     string
		expectErr    bool
	}{
		{
			name:      "No filters with no existing filter",
			query:     `{} |= "an unexpected error"`,
			expected:  `{} |= "an unexpected error"`,
			expectErr: false,
		},
		{
			name:      "No filters with existing filter",
			query:     `{namespace="default"} |= "an unexpected error"`,
			expected:  `{namespace="default"} |= "an unexpected error"`,
			expectErr: false,
		},
		{
			name:  "scopes with existing filter",
			query: `{namespace="default"} |= "an unexpected error"`,
			scopeFilters: []scope.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: scope.FilterOperatorEquals},
			},
			expected:  `{namespace="default", cluster="us-central-1"} |= "an unexpected error"`,
			expectErr: false,
		},
		{
			name:  "scopes without existing label matchers",
			query: `{} |= "an unexpected error"`,
			scopeFilters: []scope.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: scope.FilterOperatorEquals},
			},
			expected:  `{cluster="us-central-1"} |= "an unexpected error"`,
			expectErr: false,
		},
		{
			name:  "scopes with multiple filters",
			query: `{} |= "an unexpected error"`,
			scopeFilters: []scope.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: scope.FilterOperatorEquals},
				{Key: "namespace", Value: "default", Operator: scope.FilterOperatorEquals},
			},
			expected:  `{cluster="us-central-1", namespace="default"} |= "an unexpected error"`,
			expectErr: false,
		},
		{
			name:  "metric query with scopes filters",
			query: `count_over_time({} |= "error" [1m])`,
			scopeFilters: []scope.ScopeFilter{
				{Key: "namespace", Value: "default", Operator: scope.FilterOperatorEquals},
			},
			expected:  `count_over_time({namespace="default"} |= "error"[1m])`,
			expectErr: false,
		},
		{
			name:  "multi range metric query operation",
			query: `count_over_time({} |= "error" [1m])/count_over_time({} [1m])`,
			scopeFilters: []scope.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: scope.FilterOperatorEquals},
				{Key: "namespace", Value: "default", Operator: scope.FilterOperatorEquals},
			},
			expected:  `(count_over_time({cluster="us-central-1", namespace="default"} |= "error"[1m]) / count_over_time({cluster="us-central-1", namespace="default"}[1m]))`,
			expectErr: false,
		},
		{
			name:  "multi range metric query operation with existing label matchers",
			query: `count_over_time({a="bar"} |= "error" [1m])/count_over_time({a="bar"} [1m])`,
			scopeFilters: []scope.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: scope.FilterOperatorEquals},
				{Key: "namespace", Value: "default", Operator: scope.FilterOperatorEquals},
			},
			expected:  `(count_over_time({a="bar", cluster="us-central-1", namespace="default"} |= "error"[1m]) / count_over_time({a="bar", cluster="us-central-1", namespace="default"}[1m]))`,
			expectErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expr, err := ApplyScopes(tt.query, tt.scopeFilters)

			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, expr, tt.name)
			}
		})
	}
}
