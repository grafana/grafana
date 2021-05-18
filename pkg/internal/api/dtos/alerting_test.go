package dtos

import (
	"testing"
	"time"
)

func TestFormatShort(t *testing.T) {
	tcs := []struct {
		interval time.Duration
		expected string
	}{
		{interval: time.Hour, expected: "1h"},
		{interval: time.Hour + time.Minute, expected: "1h1m"},
		{interval: (time.Hour * 10) + time.Minute, expected: "10h1m"},
		{interval: (time.Hour * 10) + (time.Minute * 10) + time.Second, expected: "10h10m1s"},
		{interval: time.Minute * 10, expected: "10m"},
	}

	for _, tc := range tcs {
		got := formatShort(tc.interval)
		if got != tc.expected {
			t.Errorf("expected %s got %s interval: %v", tc.expected, got, tc.interval)
		}

		parsed, err := time.ParseDuration(tc.expected)
		if err != nil {
			t.Fatalf("could not parse expected duration")
		}

		if parsed != tc.interval {
			t.Errorf("expects the parsed duration to equal the interval. Got %v expected: %v", parsed, tc.interval)
		}
	}
}
