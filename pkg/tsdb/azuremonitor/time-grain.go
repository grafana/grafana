package azuremonitor

import (
	"fmt"
	"strconv"
	"strings"
)

// TimeGrain handles convertions between
// the ISO 8601 Duration format (PT1H), Kbn units (1h) and Time Grains (1 hour)
// Also handles using the automatic Grafana interval to calculate a ISO 8601 Duration.
type TimeGrain struct{}

var (
	smallTimeUnits = []string{"hour", "minute", "h", "m"}
)

func (tg *TimeGrain) createISO8601DurationFromInterval(interval string) (string, error) {
	if strings.Contains(interval, "ms") {
		return "PT1M", nil
	}

	timeValueString := interval[0 : len(interval)-1]
	timeValue, err := strconv.Atoi(timeValueString)
	if err != nil {
		return "", fmt.Errorf("Could not parse interval %v to an ISO 8061 duration", interval)
	}

	unit := interval[len(interval)-1:]

	if unit == "s" {
		toMinutes := (timeValue * 60) % 60

		// mimumum interval is 1m for Azure Monitor
		if toMinutes < 1 {
			toMinutes = 1
		}

		return tg.createISO8601Duration(toMinutes, "m"), nil
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
