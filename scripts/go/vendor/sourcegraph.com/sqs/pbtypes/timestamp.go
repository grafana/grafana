package pbtypes

import (
	"encoding/json"
	"time"
)

// NewTimestamp creates a new Timestamp from a time.Time.
func NewTimestamp(t time.Time) Timestamp {
	return Timestamp{Seconds: t.Unix(), Nanos: int32(t.Nanosecond())}
}

func (t Timestamp) Time() time.Time {
	return time.Unix(t.Seconds, int64(t.Nanos))
}

func (t Timestamp) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.Time())
}

func (t *Timestamp) UnmarshalJSON(data []byte) error {
	var tm time.Time
	if err := json.Unmarshal(data, &tm); err != nil {
		return err
	}
	*t = NewTimestamp(tm)
	return nil
}
