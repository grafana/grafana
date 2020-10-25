package gtime

import (
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseInterval(t *testing.T) {
	tcs := []struct {
		interval string
		duration time.Duration
		err      *regexp.Regexp
	}{
		{interval: "1d", duration: 24 * time.Hour},
		{interval: "1w", duration: 24 * 7 * time.Hour},
		{interval: "2w", duration: 24 * 7 * 2 * time.Hour},
		{interval: "1M", duration: 24 * 7 * 4 * time.Hour},
		{interval: "1y", duration: 24 * 7 * 4 * 12 * time.Hour},
		{interval: "5y", duration: 24 * 7 * 4 * 12 * 5 * time.Hour},
		{interval: "invalid-duration", err: regexp.MustCompile(`^time: invalid duration "?invalid-duration"?$`)},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			res, err := ParseInterval(tc.interval)
			if tc.err == nil {
				require.NoError(t, err, "interval %q", tc.interval)
				require.Equal(t, tc.duration, res, "interval %q", tc.interval)
			} else {
				require.Error(t, err, "interval %q", tc.interval)
				require.Regexp(t, tc.err, err.Error())
			}
		})
	}
}
