package loki

import (
	"math"
	"time"
)

// round the duration to the nearest millisecond larger-or-equal-to the duration
func ceilMs(duration time.Duration) time.Duration {
	floatMs := float64(duration.Nanoseconds()) / 1000.0 / 1000.0
	ceilMs := math.Ceil(floatMs)
	return time.Duration(ceilMs) * time.Millisecond
}

func durationMax(d1 time.Duration, d2 time.Duration) time.Duration {
	if d1.Nanoseconds() >= d2.Nanoseconds() {
		return d1
	} else {
		return d2
	}
}

func calculateStep(baseInterval time.Duration, timeRange time.Duration, resolution int64) time.Duration {
	step := time.Duration(baseInterval.Nanoseconds() * resolution)

	safeStep := timeRange / 11000

	chosenStep := durationMax(step, safeStep)

	return ceilMs(chosenStep)
}
