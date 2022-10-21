package models

import "time"

// TimeRange is a time.Time based TimeRange.
type TimeRange struct {
	From time.Time
	To   time.Time
}

type TimeRanges map[string]TimeRange // A set of time range for each RefID
