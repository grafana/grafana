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

	num, err := strconv.Atoi(string(result[1]))
	if err != nil {
		return 0, err
	}
	period := string(result[2])

	switch period {
	case "d":
		return time.Duration(num*24) * time.Hour, nil
	case "w":
		return time.Duration(num*24*7) * time.Hour, nil
	case "M":
		return time.Duration(num*24*7*4) * time.Hour, nil
	case "y":
		return time.Duration(num*24*7*4*12) * time.Hour, nil
	}

	return 0, fmt.Errorf("ParseInterval: invalid duration %q", interval)
}
