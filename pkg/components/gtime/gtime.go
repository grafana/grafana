package gtime

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

var dateUnitPattern = regexp.MustCompile(`^(\d+)([dwMy])$`)

// ParseInterval parses an interval with support for all units that Grafana uses.
func ParseInterval(interval string) (time.Duration, error) {
	result := dateUnitPattern.FindSubmatch([]byte(interval))

	if len(result) != 3 {
		return time.ParseDuration(interval)
	}

	num, _ := strconv.Atoi(string(result[1]))
	period := string(result[2])
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

	return 0, fmt.Errorf("ParseInterval: invalid duration %q", interval)
}
