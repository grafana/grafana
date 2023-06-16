package loki

import (
	"math"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
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

func calculateStep(interval time.Duration, timeRange time.Duration, resolution int64, queryStep *string) (time.Duration, error) {
	// If we don't have step from query we calculate it from interval, time range and resolution
	if queryStep == nil || *queryStep == "" {
		step := time.Duration(interval.Nanoseconds() * resolution)
		safeStep := timeRange / 11000
		chosenStep := durationMax(step, safeStep)
		return ceilMs(chosenStep), nil
	}

	step, err := intervalv2.ParseIntervalStringToTimeDuration(*queryStep)
	if err != nil {
		return step, err
	}

	return time.Duration(step.Nanoseconds() * resolution), nil
}
