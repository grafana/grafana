package loki

import (
	"testing"

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/stretchr/testify/require"
)

func TestInjectScopesIntoLokiQuery(t *testing.T) {
	tests := []struct {
		name         string
		query        string
		scopeFilters []models.ScopeFilter
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
			scopeFilters: []models.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: models.FilterOperatorEquals},
			},
			expected:  `{namespace="default", cluster="us-central-1"} |= "an unexpected error"`,
			expectErr: false,
		},
		{
			name:  "scopes without existing label matchers",
			query: `{} |= "an unexpected error"`,
			scopeFilters: []models.ScopeFilter{
				{Key: "cluster", Value: "us-central-1", Operator: models.FilterOperatorEquals},
			},
			expected:  `{cluster="us-central-1"} |= "an unexpected error"`,
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
				require.Equal(t, tt.expected, expr)
			}
		})
	}
}
