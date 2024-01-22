// Copied from https://github.com/grafana/grafana/blob/main/pkg/tsdb/intervalv2/intervalv2.go
// We're copying this to not block ourselves from decoupling until the conversation here is resolved
// https://raintank-corp.slack.com/archives/C05QFJUHUQ6/p1700064431005089
package time

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

var (
	year = time.Hour * 24 * 365
	day  = time.Hour * 24
)

// GetIntervalFrom returns the minimum interval.
// dsInterval is the string representation of data source min interval, if configured.
// queryInterval is the string representation of query interval (min interval), e.g. "10ms" or "10s".
// queryIntervalMS is a pre-calculated numeric representation of the query interval in milliseconds.
func GetIntervalFrom(dsInterval, queryInterval string, queryIntervalMS int64, defaultInterval time.Duration) (time.Duration, error) {
	// Apparently we are setting default value of queryInterval to 0s now
	interval := queryInterval
	if interval == "0s" {
		interval = ""
	}
	if interval == "" {
		if queryIntervalMS != 0 {
			return time.Duration(queryIntervalMS) * time.Millisecond, nil
		}
	}
	if interval == "" && dsInterval != "" {
		interval = dsInterval
	}
	if interval == "" {
		return defaultInterval, nil
	}

	parsedInterval, err := ParseIntervalStringToTimeDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}

	return parsedInterval, nil
}

func ParseIntervalStringToTimeDuration(interval string) (time.Duration, error) {
	formattedInterval := strings.Replace(strings.Replace(interval, "<", "", 1), ">", "", 1)
	isPureNum, err := regexp.MatchString(`^\d+$`, formattedInterval)
	if err != nil {
		return time.Duration(0), err
	}
	if isPureNum {
		formattedInterval += "s"
	}
	parsedInterval, err := gtime.ParseDuration(formattedInterval)
	if err != nil {
		return time.Duration(0), err
	}
	return parsedInterval, nil
}

// FormatDuration converts a duration into the kbn format e.g. 1m 2h or 3d
func FormatDuration(inter time.Duration) string {
	if inter >= year {
		return fmt.Sprintf("%dy", inter/year)
	}

	if inter >= day {
		return fmt.Sprintf("%dd", inter/day)
	}

	if inter >= time.Hour {
		return fmt.Sprintf("%dh", inter/time.Hour)
	}

	if inter >= time.Minute {
		return fmt.Sprintf("%dm", inter/time.Minute)
	}

	if inter >= time.Second {
		return fmt.Sprintf("%ds", inter/time.Second)
	}

	if inter >= time.Millisecond {
		return fmt.Sprintf("%dms", inter/time.Millisecond)
	}

	return "1ms"
}
