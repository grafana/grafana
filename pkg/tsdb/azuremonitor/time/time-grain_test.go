package time

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeGrain_createISO8601Duration(t *testing.T) {
	testCases := []struct {
		name     string
		value    int
		unit     string
		expected string
	}{
		{"1m", 1, "m", "PT1M"},
		{"1minute", 1, "minute", "PT1M"},
		{"2h", 2, "h", "PT2H"},
		{"2hour", 2, "hour", "PT2H"},
		{"1d", 1, "d", "P1D"},
		{"2day", 2, "day", "P2D"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			d := createISO8601Duration(tc.value, tc.unit)
			assert.Equal(t, tc.expected, d)
		})
	}
}

func TestTimeGrain_createISO8601DurationFromIntervalMS(t *testing.T) {
	testCases := []struct {
		name     string
		interval int64
		expected string
	}{
		{"100", 100, "PT1M"},
		{"59999", 59999, "PT1M"},
		{"600000", 600000, "PT10M"},
		{"172800000", 172800000, "P2D"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			d, err := CreateISO8601DurationFromIntervalMS(tc.interval)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, d)
		})
	}
}
