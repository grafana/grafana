package log

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDatabaseQueryTimer(t *testing.T) {
	testCases := []struct {
		name       string
		queryTimes []int64
		expected   int64
	}{
		{
			name:       "accumulates multiple query times",
			queryTimes: []int64{100, 50, 25},
			expected:   175,
		},
		{
			name:       "single query time",
			queryTimes: []int64{42},
			expected:   42,
		},
		{
			name:       "no queries returns zero",
			queryTimes: []int64{},
			expected:   0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			for _, queryTime := range tc.queryTimes {
				ctx = IncDBQueryTimer(ctx, queryTime)
			}
			assert.Equal(t, tc.expected, TotalDBQueryTime(ctx))
		})
	}
}
