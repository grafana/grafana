package gtime

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

var dateUnitPattern = regexp.MustCompile(`^(\d+)([dwMy])$`)

// ParseInterval parses an interval with support for all units that Grafana uses.
// An interval is relative to the current wall time.
func ParseInterval(inp string) (time.Duration, error) {
	dur, period, err := parse(inp)
	if err != nil {
		return 0, err
	}
	if period == "" {
		return dur, nil
	}

	num := int(dur)

	// Use UTC to ensure that the interval is deterministic, and daylight saving
	// doesn't cause surprises
	now := time.Now().UTC()
	switch period {
	case "d":
		return now.AddDate(0, 0, num).Sub(now), nil
	case "w":
		return now.AddDate(0, 0, num*7).Sub(now), nil
	case "M":
		return now.AddDate(0, num, 0).Sub(now), nil
	case "y":
		return now.AddDate(num, 0, 0).Sub(now), nil
	}

	return 0, fmt.Errorf("invalid interval %q", inp)
}

// ParseDuration parses a duration with support for all units that Grafana uses.
// Durations are independent of wall time.
func ParseDuration(inp string) (time.Duration, error) {
	dur, period, err := parse(inp)
	if err != nil {
		return 0, err
	}
	if period == "" {
		return dur, nil
	}

	// The average number of days in a year, using the Julian calendar
	const daysInAYear = 365.25
	const day = 24 * time.Hour
	const week = 7 * day
	const year = time.Duration(float64(day) * daysInAYear)
	const month = time.Duration(float64(year) / 12)

	switch period {
	case "d":
		return dur * day, nil
	case "w":
		return dur * week, nil
	case "M":
		return dur * month, nil
	case "y":
		return dur * year, nil
	}

	return 0, fmt.Errorf("invalid duration %q", inp)
}

func parse(inp string) (time.Duration, string, error) {
	result := dateUnitPattern.FindSubmatch([]byte(inp))
	if len(result) != 3 {
		dur, err := time.ParseDuration(inp)
		return dur, "", err
	}

	num, err := strconv.Atoi(string(result[1]))
	if err != nil {
		return 0, "", err
	}

	return time.Duration(num), string(result[2]), nil
}
