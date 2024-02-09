package interval

import (
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
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
	Calculate(timeRange legacydata.DataTimeRange, interval time.Duration) Interval
	CalculateSafeInterval(timeRange legacydata.DataTimeRange, resolution int64) Interval
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

func (ic *intervalCalculator) Calculate(timerange legacydata.DataTimeRange, minInterval time.Duration) Interval {
	to := timerange.MustGetTo().UnixNano()
	from := timerange.MustGetFrom().UnixNano()
	calculatedInterval := time.Duration((to - from) / DefaultRes)

	if calculatedInterval < minInterval {
		return Interval{Text: gtime.FormatInterval(minInterval), Value: minInterval}
	}

	rounded := roundInterval(calculatedInterval)
	return Interval{Text: gtime.FormatInterval(rounded), Value: rounded}
}

func (ic *intervalCalculator) CalculateSafeInterval(timerange legacydata.DataTimeRange, safeRes int64) Interval {
	to := timerange.MustGetTo().UnixNano()
	from := timerange.MustGetFrom().UnixNano()
	safeInterval := time.Duration((to - from) / safeRes)

	rounded := roundInterval(safeInterval)
	return Interval{Text: gtime.FormatInterval(rounded), Value: rounded}
}

func GetIntervalFrom(dsInfo *datasources.DataSource, queryModel *simplejson.Json, defaultInterval time.Duration) (time.Duration, error) {
	interval := queryModel.Get("interval").MustString("")

	// intervalMs field appears in the v2 plugins API and should be preferred
	// if 'interval' isn't present.
	if interval == "" {
		intervalMS := queryModel.Get("intervalMs").MustInt(0)
		if intervalMS != 0 {
			return time.Duration(intervalMS) * time.Millisecond, nil
		}
	}

	if interval == "" && dsInfo != nil && dsInfo.JsonData != nil {
		dsInterval := dsInfo.JsonData.Get("timeInterval").MustString("")
		if dsInterval != "" {
			interval = dsInterval
		}
	}

	if interval == "" {
		return defaultInterval, nil
	}

	interval = strings.Replace(strings.Replace(interval, "<", "", 1), ">", "", 1)
	isPureNum, err := regexp.MatchString(`^\d+$`, interval)
	if err != nil {
		return time.Duration(0), err
	}
	if isPureNum {
		interval += "s"
	}
	parsedInterval, err := gtime.ParseDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}

	return parsedInterval, nil
}

//nolint:gocyclo
func roundInterval(interval time.Duration) time.Duration {
	// 0.015s
	if interval <= 15*time.Millisecond {
		return time.Millisecond * 10 // 0.01s
	}
	return gtime.RoundInterval(interval)
}
