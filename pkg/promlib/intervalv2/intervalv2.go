// Package intervalv2 partially copied from https://github.com/grafana/grafana/blob/main/pkg/tsdb/intervalv2/intervalv2.go
package intervalv2

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

var (
	DefaultRes         int64 = 1500
	defaultMinInterval       = time.Millisecond * 1
)

type Interval struct {
	Text  string
	Value time.Duration
}

type intervalCalculator struct {
	minInterval time.Duration
}

type Calculator interface {
	Calculate(timerange backend.TimeRange, minInterval time.Duration, maxDataPoints int64) Interval
	CalculateSafeInterval(timerange backend.TimeRange, resolution int64) Interval
}

type CalculatorOptions struct {
	MinInterval time.Duration
}

func NewCalculator(opts ...CalculatorOptions) *intervalCalculator {
	calc := &intervalCalculator{}

	for _, o := range opts {
		if o.MinInterval == 0 {
			calc.minInterval = defaultMinInterval
		} else {
			calc.minInterval = o.MinInterval
		}
	}

	return calc
}

func (ic *intervalCalculator) Calculate(timerange backend.TimeRange, minInterval time.Duration, maxDataPoints int64) Interval {
	to := timerange.To.UnixNano()
	from := timerange.From.UnixNano()
	resolution := maxDataPoints
	if resolution == 0 {
		resolution = DefaultRes
	}

	calculatedInterval := time.Duration((to - from) / resolution)

	if calculatedInterval < minInterval {
		return Interval{Text: gtime.FormatInterval(minInterval), Value: minInterval}
	}

	rounded := gtime.RoundInterval(calculatedInterval)

	return Interval{Text: gtime.FormatInterval(rounded), Value: rounded}
}

func (ic *intervalCalculator) CalculateSafeInterval(timerange backend.TimeRange, safeRes int64) Interval {
	to := timerange.To.UnixNano()
	from := timerange.From.UnixNano()
	safeInterval := time.Duration((to - from) / safeRes)

	rounded := gtime.RoundInterval(safeInterval)
	return Interval{Text: gtime.FormatInterval(rounded), Value: rounded}
}
