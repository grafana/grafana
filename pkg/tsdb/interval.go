package tsdb

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

var (
	defaultRes         int64 = 1500
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

type IntervalCalculator interface {
	Calculate(timeRange *TimeRange, minInterval time.Duration) Interval
}

type IntervalOptions struct {
	MinInterval time.Duration
}

func NewIntervalCalculator(opt *IntervalOptions) *intervalCalculator {
	if opt == nil {
		opt = &IntervalOptions{}
	}

	calc := &intervalCalculator{}

	if opt.MinInterval == 0 {
		calc.minInterval = defaultMinInterval
	} else {
		calc.minInterval = opt.MinInterval
	}

	return calc
}

func (i *Interval) Milliseconds() int64 {
	return i.Value.Nanoseconds() / int64(time.Millisecond)
}

func (ic *intervalCalculator) Calculate(timerange *TimeRange, minInterval time.Duration) Interval {
	to := timerange.MustGetTo().UnixNano()
	from := timerange.MustGetFrom().UnixNano()
	interval := time.Duration((to - from) / defaultRes)

	if interval < minInterval {
		return Interval{Text: FormatDuration(minInterval), Value: minInterval}
	}

	rounded := roundInterval(interval)
	return Interval{Text: FormatDuration(rounded), Value: rounded}
}

func GetIntervalFrom(dsInfo *models.DataSource, queryModel *simplejson.Json, defaultInterval time.Duration) (time.Duration, error) {
	interval := queryModel.Get("interval").MustString("")

	if interval == "" && dsInfo.JsonData != nil {
		dsInterval := dsInfo.JsonData.Get("timeInterval").MustString("")
		if dsInterval != "" {
			interval = dsInterval
		}
	}

	if interval == "" {
		return defaultInterval, nil
	}

	interval = strings.Replace(strings.Replace(interval, "<", "", 1), ">", "", 1)
	parsedInterval, err := time.ParseDuration(interval)
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

func roundInterval(interval time.Duration) time.Duration {
	switch {
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
	// 12.5m
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
