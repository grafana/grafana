package models

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestApplyQueryFilters(t *testing.T) {
	tests := []struct {
		name         string
		query        string
		adhocFilters []ScopeFilter
		scopeFilters []ScopeFilter
		expected     string
		expectErr    bool
	}{
		{
			name:      "No filters with no existing filter",
			query:     `http_requests_total`,
			expected:  `http_requests_total`,
			expectErr: false,
		},
		{
			name:      "No filters with existing filter",
			query:     `http_requests_total{job="prometheus"}`,
			expected:  `http_requests_total{job="prometheus"}`,
			expectErr: false,
		},
		{
			name:  "Adhoc filter with existing filter",
			query: `http_requests_total{job="prometheus"}`,
			adhocFilters: []ScopeFilter{
				{Key: "method", Value: "get", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{job="prometheus",method="get"}`,
			expectErr: false,
		},
		{
			name:  "Adhoc filter with no existing filter",
			query: `http_requests_total`,
			adhocFilters: []ScopeFilter{
				{Key: "method", Value: "get", Operator: FilterOperatorEquals},
				{Key: "job", Value: "prometheus", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{job="prometheus",method="get"}`,
			expectErr: false,
		},
		{
			name:  "Scope filter",
			query: `http_requests_total{job="prometheus"}`,
			scopeFilters: []ScopeFilter{
				{Key: "status", Value: "200", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{job="prometheus",status="200"}`,
			expectErr: false,
		},
		{
			name:  "Adhoc and Scope filter no existing filter",
			query: `http_requests_total`,
			scopeFilters: []ScopeFilter{
				{Key: "status", Value: "200", Operator: FilterOperatorEquals},
			},
			adhocFilters: []ScopeFilter{
				{Key: "job", Value: "prometheus", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{job="prometheus",status="200"}`,
			expectErr: false,
		},
		{
			name:  "Adhoc and Scope filter conflict - adhoc wins",
			query: `http_requests_total{job="prometheus"}`,
			scopeFilters: []ScopeFilter{
				{Key: "status", Value: "404", Operator: FilterOperatorEquals},
			},
			adhocFilters: []ScopeFilter{
				{Key: "status", Value: "200", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{job="prometheus",status="200"}`,
			expectErr: false,
		},
		{
			name:  "Adhoc filters with more complex expression",
			query: `capacity_bytes{job="prometheus"} + available_bytes{job="grafana"} / 1024`,
			adhocFilters: []ScopeFilter{
				{Key: "job", Value: "alloy", Operator: FilterOperatorEquals},
			},
			expected:  `capacity_bytes{job="alloy"} + available_bytes{job="alloy"} / 1024`,
			expectErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expr, err := ApplyQueryFilters(tt.query, tt.scopeFilters, tt.adhocFilters)

			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, expr, tt.expected)
			}
		})
	}
}
