package azuremonitor

// setAutoTimeGrain tries to find the closest interval to the query's intervalMs value
// if the metric has a limited set of possible intervals/time grains then use those
// instead of the default list of intervals
func setAutoTimeGrain(intervalMs int64, timeGrains []int64) (string, error) {
	autoInterval := findClosestAllowedIntervalMS(intervalMs, timeGrains)
	tg := &TimeGrain{}
	autoTimeGrain, err := tg.createISO8601DurationFromIntervalMS(autoInterval)
	if err != nil {
		return "", err
	}

	return autoTimeGrain, nil
}

// findClosestAllowedIntervalMs is used for the auto time grain setting.
// It finds the closest time grain from the list of allowed time grains for Azure Monitor
// using the Grafana interval in milliseconds
// Some metrics only allow a limited list of time grains. The allowedTimeGrains parameter
// allows overriding the default list of allowed time grains.
func findClosestAllowedIntervalMS(intervalMs int64, allowedTimeGrains []int64) int64 {
	allowedIntervals := defaultAllowedIntervalsMS

	if len(allowedTimeGrains) > 0 {
		allowedIntervals = allowedTimeGrains
	}

	closest := allowedIntervals[0]

	for i, allowed := range allowedIntervals {
		if intervalMs > allowed {
			if i+1 < len(allowedIntervals) {
				closest = allowedIntervals[i+1]
			} else {
				closest = allowed
			}
		}
	}
	return closest
}
