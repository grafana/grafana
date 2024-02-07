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

func (i *Interval) Milliseconds() int64 {
	return i.Value.Nanoseconds() / int64(time.Millisecond)
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
		return Interval{Text: FormatDuration(minInterval), Value: minInterval}
	}

	rounded := gtime.RoundInterval(calculatedInterval)

	return Interval{Text: FormatDuration(rounded), Value: rounded}
}

func (ic *intervalCalculator) CalculateSafeInterval(timerange backend.TimeRange, safeRes int64) Interval {
	to := timerange.To.UnixNano()
	from := timerange.From.UnixNano()
	safeInterval := time.Duration((to - from) / safeRes)

	rounded := gtime.RoundInterval(safeInterval)
	return Interval{Text: FormatDuration(rounded), Value: rounded}
}

// GetIntervalFrom returns the minimum interval.
// dsInterval is the string representation of data source min interval, if configured.
// queryInterval is the string representation of query interval (min interval), e.g. "10ms" or "10s".
// queryIntervalMS is a pre-calculated numeric representation of the query interval in milliseconds.
//
// Deprecated: use grafana-plugin-sdk-go/backend/gtime instead
func GetIntervalFrom(dsInterval, queryInterval string, queryIntervalMS int64, defaultInterval time.Duration) (time.Duration, error) {
	return gtime.GetIntervalFrom(dsInterval, queryInterval, queryIntervalMS, defaultInterval)
}

// Deprecated: use grafana-plugin-sdk-go/backend/gtime instead
func ParseIntervalStringToTimeDuration(interval string) (time.Duration, error) {
	return gtime.ParseIntervalStringToTimeDuration(interval)
}

// FormatDuration converts a duration into the kbn format e.g. 1m 2h or 3d
//
// Deprecated: use grafana-plugin-sdk-go/backend/gtime instead
func FormatDuration(inter time.Duration) string {
	return gtime.FormatInterval(inter)
}
