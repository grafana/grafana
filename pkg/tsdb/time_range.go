package tsdb

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func NewTimeRange(from, to string) TimeRange {
	return TimeRange{
		From: from,
		To:   to,
		Now:  time.Now(),
	}
}

type TimeRange struct {
	From string
	To   string
	Now  time.Time
}

func (tr TimeRange) FromTime() (time.Time, error) {
	if val, err := strconv.ParseInt(tr.From, 10, 64); err == nil {
		return time.Unix(val, 0), nil
	}

	fromRaw := strings.Replace(tr.From, "now-", "", 1)

	diff, err := time.ParseDuration("-" + fromRaw)
	if err != nil {
		return time.Time{}, err
	}

	return tr.Now.Add(diff), nil
}

func (tr TimeRange) ToTime() (time.Time, error) {
	if tr.To == "now" {
		return tr.Now, nil
	} else if strings.HasPrefix(tr.To, "now-") {
		withoutNow := strings.Replace(tr.To, "now-", "", 1)

		diff, err := time.ParseDuration("-" + withoutNow)
		if err != nil {
			return time.Time{}, nil
		}

		return tr.Now.Add(diff), nil
	}

	if val, err := strconv.ParseInt(tr.To, 10, 64); err == nil {
		return time.Unix(val, 0), nil
	}

	return time.Time{}, fmt.Errorf("cannot parse to value %s", tr.To)
}
