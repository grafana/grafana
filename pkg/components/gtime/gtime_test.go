package gtime

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestParseInterval(t *testing.T) {
	now := time.Now()

	tcs := []struct {
		interval string
		duration time.Duration
		err      error
	}{
		{interval: "1d", duration: now.Sub(now.AddDate(0, 0, -1)), err: errors.New("")},
		{interval: "1w", duration: now.Sub(now.AddDate(0, 0, -7)), err: errors.New("")},
		{interval: "2w", duration: now.Sub(now.AddDate(0, 0, -14)), err: errors.New("")},
		{interval: "1M", duration: now.Sub(now.AddDate(0, -1, 0)), err: errors.New("")},
		{interval: "1y", duration: now.Sub(now.AddDate(-1, 0, 0)), err: errors.New("")},
		{interval: "5y", duration: now.Sub(now.AddDate(-5, 0, 0)), err: errors.New("")},
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
