package gtime

import (
	"regexp"
	"strconv"
	"time"
)

var dateUnitPattern = regexp.MustCompile(`(\d+)([wdy])`)

// ParseInterval parses an interval with support for all units that Grafana uses.
func ParseInterval(interval string) (time.Duration, error) {
	result := dateUnitPattern.FindSubmatch([]byte(interval))

	if len(result) != 3 {
		return time.ParseDuration(interval)
	}

	num, _ := strconv.Atoi(string(result[1]))
	period := string(result[2])

	if period == `d` {
		return time.Hour * 24 * time.Duration(num), nil
	}

	if period == `w` {
		return time.Hour * 24 * 7 * time.Duration(num), nil
	}

	return time.Hour * 24 * 7 * 365 * time.Duration(num), nil
}
