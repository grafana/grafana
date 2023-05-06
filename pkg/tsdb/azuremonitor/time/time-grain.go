package time

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

// TimeGrain handles conversions between
// the ISO 8601 Duration format (PT1H), Kbn units (1h) and Time Grains (1 hour)
// Also handles using the automatic Grafana interval to calculate a ISO 8601 Duration.
var (
	smallTimeUnits = []string{"hour", "minute", "h", "m"}
)

func CreateISO8601DurationFromIntervalMS(it int64) (string, error) {
	formatted := intervalv2.FormatDuration(time.Duration(it) * time.Millisecond)

	if strings.Contains(formatted, "ms") {
		return "PT1M", nil
	}

	timeValueString := formatted[0 : len(formatted)-1]
	timeValue, err := strconv.Atoi(timeValueString)
	if err != nil {
		return "", fmt.Errorf("could not parse interval %q to an ISO 8061 duration: %w", it, err)
	}

	unit := formatted[len(formatted)-1:]

	if unit == "s" && timeValue < 60 {
		// minimum interval is 1m for Azure Monitor
		return "PT1M", nil
	}

	return createISO8601Duration(timeValue, unit), nil
}

func createISO8601Duration(timeValue int, timeUnit string) string {
	for _, smallTimeUnit := range smallTimeUnits {
		if timeUnit == smallTimeUnit {
			return fmt.Sprintf("PT%v%v", timeValue, strings.ToUpper(timeUnit[0:1]))
		}
	}

	return fmt.Sprintf("P%v%v", timeValue, strings.ToUpper(timeUnit[0:1]))
}
