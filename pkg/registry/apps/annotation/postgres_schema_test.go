package annotation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGetPartitionName(t *testing.T) {
	tests := []struct {
		name     string
		ts       int64
		expected string
	}{
		{
			name:     "regular week",
			ts:       time.Date(2025, 3, 12, 15, 30, 0, 0, time.UTC).UnixMilli(),
			expected: "annotations_2025w11",
		},
		{
			name:     "year boundary",
			ts:       time.Date(2025, 12, 29, 12, 0, 0, 0, time.UTC).UnixMilli(),
			expected: "annotations_2026w01", // ISO week 1 of 2026
		},
		{
			name:     "week 53",
			ts:       time.Date(2020, 12, 28, 12, 0, 0, 0, time.UTC).UnixMilli(),
			expected: "annotations_2020w53",
		},
		{
			name:     "first day of year in previous year's week",
			ts:       time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
			expected: "annotations_2020w53", // Jan 1, 2021 is a Friday in 2020's week 53
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getPartitionName(tt.ts)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetPartitionBounds(t *testing.T) {
	tests := []struct {
		name           string
		ts             int64
		expectedStart  time.Time
		expectedEndSub time.Duration // Duration from start to end
	}{
		{
			name:           "mid-week Wednesday",
			ts:             time.Date(2025, 3, 12, 15, 30, 0, 0, time.UTC).UnixMilli(),
			expectedStart:  time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), // Monday
			expectedEndSub: 7 * 24 * time.Hour,
		},
		{
			name:           "Monday at midnight",
			ts:             time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC).UnixMilli(),
			expectedStart:  time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC),
			expectedEndSub: 7 * 24 * time.Hour,
		},
		{
			name:           "Sunday end of week",
			ts:             time.Date(2025, 3, 16, 23, 59, 59, 0, time.UTC).UnixMilli(),
			expectedStart:  time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), // Previous Monday
			expectedEndSub: 7 * 24 * time.Hour,
		},
		{
			name:           "year boundary spanning week",
			ts:             time.Date(2025, 12, 29, 12, 0, 0, 0, time.UTC).UnixMilli(), // Monday in week spanning 2025-2026
			expectedStart:  time.Date(2025, 12, 29, 0, 0, 0, 0, time.UTC),
			expectedEndSub: 7 * 24 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start, end := getPartitionBounds(tt.ts)

			actualStart := time.UnixMilli(start).UTC()
			actualEnd := time.UnixMilli(end).UTC()

			// Verify start matches expected
			assert.Equal(t, tt.expectedStart, actualStart)

			// Verify start is Monday at midnight
			assert.Equal(t, time.Monday, actualStart.Weekday())
			assert.Equal(t, 0, actualStart.Hour())
			assert.Equal(t, 0, actualStart.Minute())
			assert.Equal(t, 0, actualStart.Second())

			// Verify end is exactly 7 days later
			assert.Equal(t, tt.expectedEndSub, actualEnd.Sub(actualStart))

			// Verify timestamp is within bounds
			assert.GreaterOrEqual(t, tt.ts, start)
			assert.Less(t, tt.ts, end)
		})
	}
}
