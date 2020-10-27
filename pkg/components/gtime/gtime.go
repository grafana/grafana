package gtime

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

var dateUnitPattern = regexp.MustCompile(`^(\d+)([dwMy])$`)

// ParseInterval parses an interval with support for all units that Grafana uses.
// An interval is relative the current wall time.
func ParseInterval(inp string) (time.Duration, error) {
	num, period, err := parse(inp)
	if err != nil {
		return 0, err
	}
	if period == "" {
		return time.Duration(num), nil
	}

	now := time.Now()
	switch period {
	case "d":
		return now.Sub(now.AddDate(0, 0, -num)), nil
	case "w":
		return now.Sub(now.AddDate(0, 0, -num*7)), nil
	case "M":
		return now.Sub(now.AddDate(0, -num, 0)), nil
	case "y":
		return now.Sub(now.AddDate(-num, 0, 0)), nil
	}

	return 0, fmt.Errorf("invalid interval %q", inp)
}

// ParseDuration parses a duration with support for all units that Grafana uses.
func ParseDuration(inp string) (time.Duration, error) {
	num, period, err := parse(inp)
	if err != nil {
		return 0, err
	}
	if period == "" {
		return time.Duration(num), nil
	}

	// The average number of days in a year, using the Julian calendar
	const daysInAYear = 365.25

	switch period {
	case "d":
		return time.Duration(num*24) * time.Hour, nil
	case "w":
		return time.Duration(num*24*7) * time.Hour, nil
	case "M":
		return time.Duration(int64(float64(num*24)*(daysInAYear/12))) * time.Hour, nil
	case "y":
		return time.Duration(int64(float64(num*24)*daysInAYear)) * time.Hour, nil
	}

	return 0, fmt.Errorf("invalid duration %q", inp)
}

func parse(inp string) (int, string, error) {
	result := dateUnitPattern.FindSubmatch([]byte(inp))
	if len(result) != 3 {
		dur, err := time.ParseDuration(inp)
		return int(dur), "", err
	}

	num, err := strconv.Atoi(string(result[1]))
	if err != nil {
		return 0, "", err
	}

	return num, string(result[2]), nil
}
