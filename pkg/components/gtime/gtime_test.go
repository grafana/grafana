package gtime

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestParseInterval(t *testing.T) {
	tcs := []struct {
		interval string
		duration time.Duration
		err      error
	}{
		{interval: "1d", duration: time.Hour * 24},
		{interval: "1w", duration: time.Hour * 24 * 7},
		{interval: "2w", duration: time.Hour * 24 * 7 * 2},
		{interval: "1y", duration: time.Hour * 24 * 7 * 365},
		{interval: "5y", duration: time.Hour * 24 * 7 * 365 * 5},
		{interval: "1M", err: errors.New("time: unknown unit M in duration 1M")},
		{interval: "invalid-duration", err: errors.New("time: invalid duration invalid-duration")},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			res, err := ParseInterval(tc.interval)
			if err != nil && err.Error() != tc.err.Error() {
				t.Fatalf("expected '%v' got '%v'", tc.err, err)
			}
			if res != tc.duration {
				t.Errorf("expected %v got %v", tc.duration, res)
			}
		})
	}
}
