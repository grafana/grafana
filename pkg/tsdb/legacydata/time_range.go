package legacydata

import (
	"strconv"
	"time"

	"github.com/vectordotdev/go-datemath"
)

type DataTimeRange struct {
	From string
	To   string
	Now  time.Time
}

func NewDataTimeRange(from, to string) DataTimeRange {
	return DataTimeRange{
		From: from,
		To:   to,
		Now:  time.Now(),
	}
}

func (tr DataTimeRange) GetFromAsMsEpoch() int64 {
	return tr.MustGetFrom().UnixNano() / int64(time.Millisecond)
}

func (tr DataTimeRange) GetFromAsSecondsEpoch() int64 {
	return tr.GetFromAsMsEpoch() / 1000
}

func (tr DataTimeRange) GetFromAsTimeUTC() time.Time {
	return tr.MustGetFrom().UTC()
}

func (tr DataTimeRange) GetToAsMsEpoch() int64 {
	return tr.MustGetTo().UnixNano() / int64(time.Millisecond)
}

func (tr DataTimeRange) GetToAsSecondsEpoch() int64 {
	return tr.GetToAsMsEpoch() / 1000
}

func (tr DataTimeRange) GetToAsTimeUTC() time.Time {
	return tr.MustGetTo().UTC()
}

func (tr DataTimeRange) MustGetFrom() time.Time {
	res, err := tr.ParseFrom()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr DataTimeRange) MustGetTo() time.Time {
	res, err := tr.ParseTo()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr DataTimeRange) ParseFrom(options ...TimeRangeOption) (time.Time, error) {
	options = append(options, WithNow(tr.Now))

	pt := newParsableTime(tr.From, options...)
	return pt.Parse()
}

func (tr DataTimeRange) ParseTo(options ...TimeRangeOption) (time.Time, error) {
	options = append(options, WithRoundUp(), WithNow(tr.Now))

	pt := newParsableTime(tr.To, options...)
	return pt.Parse()
}

func WithWeekstart(weekday time.Weekday) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.weekstart = &weekday
		return timeRange
	}
}

func WithLocation(loc *time.Location) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.location = loc
		return timeRange
	}
}

func WithFiscalStartMonth(month time.Month) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.fiscalStartMonth = &month
		return timeRange
	}
}

func WithNow(t time.Time) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.now = t
		return timeRange
	}
}

func WithRoundUp() TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.roundUp = true
		return timeRange
	}
}

type parsableTime struct {
	time             string
	now              time.Time
	location         *time.Location
	weekstart        *time.Weekday
	fiscalStartMonth *time.Month
	roundUp          bool
}

type TimeRangeOption func(timeRange parsableTime) parsableTime

func newParsableTime(t string, options ...TimeRangeOption) parsableTime {
	p := parsableTime{
		time: t,
		now:  time.Now(),
	}

	for _, opt := range options {
		p = opt(p)
	}

	return p
}

func (t parsableTime) Parse() (time.Time, error) {
	// Milliseconds since Unix epoch.
	if val, err := strconv.ParseInt(t.time, 10, 64); err == nil {
		return time.UnixMilli(val), nil
	}

	// Duration relative to current time.
	if diff, err := time.ParseDuration("-" + t.time); err == nil {
		return t.now.Add(diff), nil
	}

	// Advanced time string, mimics the frontend's datemath library.
	return datemath.ParseAndEvaluate(t.time, t.datemathOptions()...)
}

func (t parsableTime) datemathOptions() []func(*datemath.Options) {
	options := []func(*datemath.Options){
		datemath.WithNow(t.now),
		datemath.WithRoundUp(t.roundUp),
	}
	if t.location != nil {
		options = append(options, datemath.WithLocation(t.location))
	}
	if t.weekstart != nil {
		options = append(options, datemath.WithStartOfWeek(*t.weekstart))
	}
	if t.fiscalStartMonth != nil {
		loc := time.UTC
		if t.location != nil {
			loc = t.location
		}
		options = append(options, datemath.WithStartOfFiscalYear(
			// Year doesn't matter, and Grafana only supports setting the
			// month that the fiscal year starts in.
			time.Date(0, *t.fiscalStartMonth, 1, 0, 0, 0, 0, loc),
		))
	}
	return options
}
