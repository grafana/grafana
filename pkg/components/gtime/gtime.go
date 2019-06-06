package gtime

import (
	"regexp"
	"strconv"
	"time"
)

// ParseInterval parses and interval with support for all units that Grafana uses.
func ParseInterval(interval string) (time.Duration, error) {
	re := regexp.MustCompile(`(\d+)([wdy])`)
	result := re.FindSubmatch([]byte(interval))

	if len(result) == 3 {
		num, _ := strconv.Atoi(string(result[1]))
		period := string(result[2])

		if period == `d` {
			return time.Hour * 24 * time.Duration(num), nil
		} else if period == `w` {
			return time.Hour * 24 * 7 * time.Duration(num), nil
		} else {
			return time.Hour * 24 * 7 * 365 * time.Duration(num), nil
		}
	} else {
		return time.ParseDuration(interval)
	}
}
