package metrics

import "math"

func calculateDelta(oldValue, newValue int64) int64 {
	if oldValue < newValue {
		return newValue - oldValue
	} else {
		return (math.MaxInt64 - oldValue) + (newValue - math.MinInt64) + 1
	}
}
