package tsdb

import (
	"fmt"
	"strings"
	"time"
)

func NewTimerange(from, to string) TimeRange {
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

	return time.Time{}, fmt.Errorf("cannot parse to value %s", tr.To)
}
