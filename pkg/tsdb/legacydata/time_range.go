package legacydata

import (
	"strconv"
	"time"

	"github.com/timberio/go-datemath"
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

func (tr *DataTimeRange) GetFromAsMsEpoch() int64 {
	return tr.MustGetFrom().UnixNano() / int64(time.Millisecond)
}

func (tr *DataTimeRange) GetFromAsSecondsEpoch() int64 {
	return tr.GetFromAsMsEpoch() / 1000
}

func (tr *DataTimeRange) GetFromAsTimeUTC() time.Time {
	return tr.MustGetFrom().UTC()
}

func (tr *DataTimeRange) GetToAsMsEpoch() int64 {
	return tr.MustGetTo().UnixNano() / int64(time.Millisecond)
}

func (tr *DataTimeRange) GetToAsSecondsEpoch() int64 {
	return tr.GetToAsMsEpoch() / 1000
}

func (tr *DataTimeRange) GetToAsTimeUTC() time.Time {
	return tr.MustGetTo().UTC()
}

func (tr *DataTimeRange) MustGetFrom() time.Time {
	res, err := tr.ParseFrom()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr *DataTimeRange) MustGetTo() time.Time {
	res, err := tr.ParseTo()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr DataTimeRange) ParseFrom() (time.Time, error) {
	return parseTimeRange(tr.From, tr.Now, false, nil)
}

func (tr DataTimeRange) ParseTo() (time.Time, error) {
	return parseTimeRange(tr.To, tr.Now, true, nil)
}

func (tr DataTimeRange) ParseFromWithLocation(location *time.Location) (time.Time, error) {
	return parseTimeRange(tr.From, tr.Now, false, location)
}

func (tr DataTimeRange) ParseToWithLocation(location *time.Location) (time.Time, error) {
	return parseTimeRange(tr.To, tr.Now, true, location)
}

func (tr DataTimeRange) ParseFromWithWeekStart(location *time.Location, weekstart time.Weekday) (time.Time, error) {
	return parseTimeRangeWithWeekStart(tr.From, tr.Now, false, location, weekstart)
}

func (tr *DataTimeRange) ParseToWithWeekStart(location *time.Location, weekstart time.Weekday) (time.Time, error) {
	return parseTimeRangeWithWeekStart(tr.To, tr.Now, true, location, weekstart)
}

func parseTimeRange(s string, now time.Time, withRoundUp bool, location *time.Location) (time.Time, error) {
	return parseTimeRangeWithWeekStart(s, now, withRoundUp, location, -1)
}

func parseTimeRangeWithWeekStart(s string, now time.Time, withRoundUp bool, location *time.Location, weekstart time.Weekday) (time.Time, error) {
	if val, err := strconv.ParseInt(s, 10, 64); err == nil {
		seconds := val / 1000
		nano := (val - seconds*1000) * 1000000
		return time.Unix(seconds, nano), nil
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
