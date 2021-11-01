package tsdb

import (
	"strconv"
	"time"

	"github.com/timberio/go-datemath"
)

func NewTimeRange(from, to string) *TimeRange {
	return &TimeRange{
		From: from,
		To:   to,
		now:  time.Now(),
	}
}

func NewFakeTimeRange(from, to string, now time.Time) *TimeRange {
	return &TimeRange{
		From: from,
		To:   to,
		now:  now,
	}
}

type TimeRange struct {
	From string
	To   string
	now  time.Time
}

func (tr *TimeRange) GetFromAsMsEpoch() int64 {
	return tr.MustGetFrom().UnixNano() / int64(time.Millisecond)
}

func (tr *TimeRange) GetFromAsSecondsEpoch() int64 {
	return tr.GetFromAsMsEpoch() / 1000
}

func (tr *TimeRange) GetFromAsTimeUTC() time.Time {
	return tr.MustGetFrom().UTC()
}

func (tr *TimeRange) GetToAsMsEpoch() int64 {
	return tr.MustGetTo().UnixNano() / int64(time.Millisecond)
}

func (tr *TimeRange) GetToAsSecondsEpoch() int64 {
	return tr.GetToAsMsEpoch() / 1000
}

func (tr *TimeRange) GetToAsTimeUTC() time.Time {
	return tr.MustGetTo().UTC()
}

func (tr *TimeRange) MustGetFrom() time.Time {
	res, err := tr.ParseFrom()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr *TimeRange) MustGetTo() time.Time {
	res, err := tr.ParseTo()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func tryParseUnixMsEpoch(val string) (time.Time, bool) {
	if val, err := strconv.ParseInt(val, 10, 64); err == nil {
		seconds := val / 1000
		nano := (val - seconds*1000) * 1000000
		return time.Unix(seconds, nano), true
	}
	return time.Time{}, false
}

func (tr *TimeRange) ParseFrom() (time.Time, error) {
	return parse(tr.From, tr.now, false, nil, -1)
}

func (tr *TimeRange) ParseTo() (time.Time, error) {
	return parse(tr.To, tr.now, true, nil, -1)
}

func (tr *TimeRange) ParseFromWithLocation(location *time.Location) (time.Time, error) {
	return parse(tr.From, tr.now, false, location, -1)
}

func (tr *TimeRange) ParseToWithLocation(location *time.Location) (time.Time, error) {
	return parse(tr.To, tr.now, true, location, -1)
}

func (tr *TimeRange) ParseFromWithWeekStart(location *time.Location, weekstart time.Weekday) (time.Time, error) {
	return parse(tr.From, tr.now, false, location, weekstart)
}

func (tr *TimeRange) ParseToWithWeekStart(location *time.Location, weekstart time.Weekday) (time.Time, error) {
	return parse(tr.To, tr.now, true, location, weekstart)
}

func parse(s string, now time.Time, withRoundUp bool, location *time.Location, weekstart time.Weekday) (time.Time, error) {
	if res, ok := tryParseUnixMsEpoch(s); ok {
		return res, nil
	}

	diff, err := time.ParseDuration("-" + s)
	if err != nil {
		options := []func(*datemath.Options){
			datemath.WithNow(now),
			datemath.WithRoundUp(withRoundUp),
		}
		if location != nil {
			options = append(options, datemath.WithLocation(location))
		}
		if weekstart != -1 {
			if weekstart > now.Weekday() {
				weekstart = weekstart - 7
			}
			options = append(options, datemath.WithStartOfWeek(weekstart))
		}

		return datemath.ParseAndEvaluate(s, options...)
	}

	return now.Add(diff), nil
}
