package models

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestApplyQueryFiltersAndGroupBy_Filters(t *testing.T) {
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
			name:  "Adhoc and Scope filter conflict - adhoc wins (if not oneOf or notOneOf)",
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
		{
			name:  "OneOf Operator is combined into a single regex filter",
			query: `http_requests_total{job="prometheus"}`,
			scopeFilters: []ScopeFilter{
				{Key: "status", Values: []string{"404", "400"}, Operator: FilterOperatorOneOf},
			},
			expected:  `http_requests_total{job="prometheus",status=~"404|400"}`,
			expectErr: false,
		},
		{
			name:  "using __name__ as part of the query",
			query: `{__name__="http_requests_total"}`,
			scopeFilters: []ScopeFilter{
				{Key: "namespace", Value: "istio", Operator: FilterOperatorEquals},
			},
			expected:  `{__name__="http_requests_total",namespace="istio"}`,
			expectErr: false,
		},
		{
			name:  "merge scopes filters into using OR if they share filter key",
			query: `http_requests_total{}`,
			scopeFilters: []ScopeFilter{
				{Key: "namespace", Value: "default", Operator: FilterOperatorEquals},
				{Key: "namespace", Value: "kube-system", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{namespace=~"default|kube-system"}`,
			expectErr: false,
		},
		{
			name:  "adhoc filters win over scope filters if they share filter key",
			query: `http_requests_total{}`,
			scopeFilters: []ScopeFilter{
				{Key: "namespace", Value: "default", Operator: FilterOperatorEquals},
				{Key: "namespace", Value: "kube-system", Operator: FilterOperatorEquals},
			},
			adhocFilters: []ScopeFilter{
				{Key: "namespace", Value: "adhoc-wins", Operator: FilterOperatorEquals},
			},
			expected:  `http_requests_total{namespace="adhoc-wins"}`,
			expectErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expr, err := ApplyFiltersAndGroupBy(tt.query, tt.scopeFilters, tt.adhocFilters, nil)

			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, expr, tt.name)
			}
		})
	}
}

func TestApplyQueryFiltersAndGroupBy_GroupBy(t *testing.T) {
	tests := []struct {
		name      string
		query     string
		groupBy   []string
		expected  string
		expectErr bool
	}{
		{
			name:      "GroupBy with no aggregate expression",
			groupBy:   []string{"job"},
			query:     `http_requests_total`,
			expected:  `http_requests_total`,
			expectErr: false,
		},
		{
			name:      "No GroupBy with aggregate expression",
			query:     `sum by () (http_requests_total)`,
			expected:  `sum(http_requests_total)`,
			expectErr: false,
		},
		{
			name:      "GroupBy with aggregate expression with no existing group by",
			groupBy:   []string{"job"},
			query:     `sum(http_requests_total)`,
			expected:  `sum by (job) (http_requests_total)`,
			expectErr: false,
		},
		{
			name:      "GroupBy with aggregate expression with existing group by",
			groupBy:   []string{"status"},
			query:     `sum by (job) (http_requests_total)`,
			expected:  `sum by (job, status) (http_requests_total)`,
			expectErr: false,
		},
		{
			name:      "GroupBy with aggregate expression with existing group by (already exists)",
			groupBy:   []string{"job"},
			query:     `sum by (job) (http_requests_total)`,
			expected:  `sum by (job) (http_requests_total)`,
			expectErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expr, err := ApplyFiltersAndGroupBy(tt.query, nil, nil, tt.groupBy)

			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, expr, tt.expected)
			}
		})
	}
}

func TestApplyQueryFiltersAndGroupBy(t *testing.T) {
	tests := []struct {
		name         string
		query        string
		adhocFilters []ScopeFilter
		scopeFilters []ScopeFilter
		groupby      []string
		expected     string
		expectErr    bool
	}{

		{
			name:  "Adhoc filters with more complex expression",
			query: `sum(capacity_bytes{job="prometheus"} + available_bytes{job="grafana"}) / 1024`,
			adhocFilters: []ScopeFilter{
				{Key: "job", Value: "alloy", Operator: FilterOperatorEquals},
			},
			scopeFilters: []ScopeFilter{
				{Key: "vol", Value: "/", Operator: FilterOperatorEquals},
			},
			groupby:   []string{"job"},
			expected:  `sum by (job) (capacity_bytes{job="alloy",vol="/"} + available_bytes{job="alloy",vol="/"}) / 1024`,
			expectErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expr, err := ApplyFiltersAndGroupBy(tt.query, tt.scopeFilters, tt.adhocFilters, tt.groupby)

			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, expr, tt.expected)
			}
		})
	}
}
