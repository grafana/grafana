package intervalv2

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

var (
	DefaultRes         int64 = 1500
	defaultMinInterval       = time.Millisecond * 1
	year                     = time.Hour * 24 * 365
	day                      = time.Hour * 24
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

	rounded := roundInterval(calculatedInterval)

	return Interval{Text: FormatDuration(rounded), Value: rounded}
}

func (ic *intervalCalculator) CalculateSafeInterval(timerange backend.TimeRange, safeRes int64) Interval {
	to := timerange.To.UnixNano()
	from := timerange.From.UnixNano()
	safeInterval := time.Duration((to - from) / safeRes)

	rounded := roundInterval(safeInterval)
	return Interval{Text: FormatDuration(rounded), Value: rounded}
}

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

//nolint: gocyclo
func roundInterval(interval time.Duration) time.Duration {
	switch {
	// 0.01s
	case interval <= 10*time.Millisecond:
		return time.Millisecond * 1 // 0.001s
	// 0.015s
	case interval <= 15*time.Millisecond:
		return time.Millisecond * 10 // 0.01s
	// 0.035s
	case interval <= 35*time.Millisecond:
		return time.Millisecond * 20 // 0.02s
	// 0.075s
	case interval <= 75*time.Millisecond:
		return time.Millisecond * 50 // 0.05s
	// 0.15s
	case interval <= 150*time.Millisecond:
		return time.Millisecond * 100 // 0.1s
	// 0.35s
	case interval <= 350*time.Millisecond:
		return time.Millisecond * 200 // 0.2s
	// 0.75s
	case interval <= 750*time.Millisecond:
		return time.Millisecond * 500 // 0.5s
	// 1.5s
	case interval <= 1500*time.Millisecond:
		return time.Millisecond * 1000 // 1s
	// 3.5s
	case interval <= 3500*time.Millisecond:
		return time.Millisecond * 2000 // 2s
	// 7.5s
	case interval <= 7500*time.Millisecond:
		return time.Millisecond * 5000 // 5s
	// 12.5s
	case interval <= 12500*time.Millisecond:
		return time.Millisecond * 10000 // 10s
	// 17.5s
	case interval <= 17500*time.Millisecond:
		return time.Millisecond * 15000 // 15s
	// 25s
	case interval <= 25000*time.Millisecond:
		return time.Millisecond * 20000 // 20s
	// 45s
	case interval <= 45000*time.Millisecond:
		return time.Millisecond * 30000 // 30s
	// 1.5m
	case interval <= 90000*time.Millisecond:
		return time.Millisecond * 60000 // 1m
	// 3.5m
	case interval <= 210000*time.Millisecond:
		return time.Millisecond * 120000 // 2m
	// 7.5m
	case interval <= 450000*time.Millisecond:
		return time.Millisecond * 300000 // 5m
	// 12.5m
	case interval <= 750000*time.Millisecond:
		return time.Millisecond * 600000 // 10m
	// 17.5m
	case interval <= 1050000*time.Millisecond:
		return time.Millisecond * 900000 // 15m
	// 25m
	case interval <= 1500000*time.Millisecond:
		return time.Millisecond * 1200000 // 20m
	// 45m
	case interval <= 2700000*time.Millisecond:
		return time.Millisecond * 1800000 // 30m
	// 1.5h
	case interval <= 5400000*time.Millisecond:
		return time.Millisecond * 3600000 // 1h
	// 2.5h
	case interval <= 9000000*time.Millisecond:
		return time.Millisecond * 7200000 // 2h
	// 4.5h
	case interval <= 16200000*time.Millisecond:
		return time.Millisecond * 10800000 // 3h
	// 9h
	case interval <= 32400000*time.Millisecond:
		return time.Millisecond * 21600000 // 6h
	// 24h
	case interval <= 86400000*time.Millisecond:
		return time.Millisecond * 43200000 // 12h
	// 48h
	case interval <= 172800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 1w
	case interval <= 604800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 3w
	case interval <= 1814400000*time.Millisecond:
		return time.Millisecond * 604800000 // 1w
	// 2y
	case interval < 3628800000*time.Millisecond:
		return time.Millisecond * 2592000000 // 30d
	default:
		return time.Millisecond * 31536000000 // 1y
	}
}
