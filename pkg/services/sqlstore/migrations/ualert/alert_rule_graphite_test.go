package ualert

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnwrapTarget(t *testing.T) {
	// Define the test cases
	testCases := []struct {
		name     string
		refID    string
		targets  []target
		expected string
		wantErr  bool
	}{
		{
			name:  "Valid reference substitution",
			refID: "C",
			targets: []target{
				{
					RefID:  "A",
					Target: "first.query.count",
				},
				{
					RefID:  "B",
					Target: "second.query.count",
				},
				{
					RefID:  "C",
					Target: "scale(asPercent(diffSeries(#B, #A), #B), 100)",
				},
			},
			expected: "scale(asPercent(diffSeries(second.query.count, first.query.count), second.query.count), 100)",
			wantErr:  false,
		},
		{
			name:  "No error on multiple matches",
			refID: "D",
			targets: []target{
				{
					RefID:  "D",
					Target: "alias(divideSeries(scale(#C, 100.0), #B), 'SLI')",
				},
				{
					RefID:  "C",
					Target: "integral(aggregations.secondly.chef.api.client.domain.transaction.statusok.count)",
				},
				{
					RefID:  "B",
					Target: "sumSeries(#A, #C)",
				},
				{
					RefID:  "A",
					Target: "integral(aggregations.secondly.chef.api.client.domain.transaction.statusnook.count)",
				},
			},
			expected: "alias(divideSeries(scale(integral(aggregations.secondly.chef.api.client.domain.transaction.statusok.count), 100.0), sumSeries(integral(aggregations.secondly.chef.api.client.domain.transaction.statusnook.count), integral(aggregations.secondly.chef.api.client.domain.transaction.statusok.count))), 'SLI')",
			wantErr:  false,
		},
		{
			name:  "Error on circular references",
			refID: "D",
			targets: []target{
				{
					RefID:  "D",
					Target: "alias(divideSeries(scale(#C, 100.0), #B), 'SLI')",
				},
				{
					RefID:  "B",
					Target: "sumSeries(#A, #D)",
				},
				{
					RefID:  "A",
					Target: "integral(aggregations.secondly.chef.api.client.domain.transaction.statusnook.count)",
				},
			},
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Act
			result, err := unwrapTarget(tc.refID, tc.targets)

			// Assert
			if tc.wantErr {
				require.Error(t, err, "unwrapTarget should return an error")
			} else {
				require.NoError(t, err, "unwrapTarget should not return an error")
				require.Equal(t, tc.expected, result, "unwrapTarget returned unexpected result")
			}
		})
	}
}
