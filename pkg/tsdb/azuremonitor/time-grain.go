package azuremonitor

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

// TimeGrain handles conversions between
// the ISO 8601 Duration format (PT1H), Kbn units (1h) and Time Grains (1 hour)
// Also handles using the automatic Grafana interval to calculate a ISO 8601 Duration.
type TimeGrain struct{}

var (
	smallTimeUnits = []string{"hour", "minute", "h", "m"}
)

func (tg *TimeGrain) createISO8601DurationFromIntervalMS(interval int64) (string, error) {
	formatted := tsdb.FormatDuration(time.Duration(interval) * time.Millisecond)

	if strings.Contains(formatted, "ms") {
		return "PT1M", nil
	}

	timeValueString := formatted[0 : len(formatted)-1]
	timeValue, err := strconv.Atoi(timeValueString)
	if err != nil {
		return "", fmt.Errorf("Could not parse interval %v to an ISO 8061 duration", interval)
	}

	unit := formatted[len(formatted)-1:]

	if unit == "s" && timeValue < 60 {
		// minimum interval is 1m for Azure Monitor
		return "PT1M", nil
	}

	return tg.createISO8601Duration(timeValue, unit), nil
}

func (tg *TimeGrain) createISO8601Duration(timeValue int, timeUnit string) string {
	for _, smallTimeUnit := range smallTimeUnits {
		if timeUnit == smallTimeUnit {
			return fmt.Sprintf("PT%v%v", timeValue, strings.ToUpper(timeUnit[0:1]))
		}
	}

	return fmt.Sprintf("P%v%v", timeValue, strings.ToUpper(timeUnit[0:1]))
}
