package legacysql

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// dbTimeMillisLayout is the wire format for DBTime values with a non-zero
// millisecond component, letting a DBTime column act as a fine-grained
// optimistic-concurrency token (e.g. team.updated as a resourceVersion).
// Whole-second values emit `time.DateTime` instead, so text-based
// `WHERE updated = ?` comparisons against second-precision rows match.
const dbTimeMillisLayout = "2006-01-02 15:04:05.000"

type DBTime struct {
	time.Time
}

func NewDBTime(t time.Time) DBTime {
	return DBTime{Time: t}
}

func (t DBTime) wireLayout() string {
	if t.Nanosecond() < int(time.Millisecond) {
		return time.DateTime
	}
	return dbTimeMillisLayout
}

func (t DBTime) Value() (driver.Value, error) {
	if t.IsZero() {
		return nil, nil
	}

	return t.Format(t.wireLayout()), nil
}

func (t DBTime) String() string {
	if t.IsZero() {
		return ""
	}

	return t.Format(t.wireLayout())
}

func (t *DBTime) Scan(value interface{}) error {
	if value == nil {
		t.Time = time.Time{}
		return nil
	}

	var parsedTime time.Time
	var err error

	switch v := value.(type) {
	case []byte:
		parsedTime, err = parseDBTimeString(string(v))
	case string:
		parsedTime, err = parseDBTimeString(v)
	case time.Time:
		parsedTime = v
	default:
		return fmt.Errorf("could not scan type %T into DBTime", value)
	}

	if err != nil {
		return fmt.Errorf("could not parse time: %w", err)
	}

	t.Time = parsedTime
	return nil
}

// parseDBTimeString accepts either the millisecond layout or the legacy
// second layout (`time.DateTime`).
func parseDBTimeString(s string) (time.Time, error) {
	if t, err := time.Parse(dbTimeMillisLayout, s); err == nil {
		return t, nil
	}
	return time.Parse(time.DateTime, s)
}
