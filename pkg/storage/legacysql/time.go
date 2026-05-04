package legacysql

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// dbTimeMillisLayout is the wire format for DBTime values that carry a
// non-zero millisecond component. Millisecond precision lets callers use a
// DBTime column as a fine-grained optimistic-concurrency token (e.g.
// team.updated as a resourceVersion).
//
// SQLite stores it verbatim as TEXT, Postgres TIMESTAMP coerces from the
// fractional-second literal, and MySQL DATETIME silently truncates the
// fractional part — same behaviour it has had for any second-precision
// write today. DBTime.Scan accepts either layout so reads of values
// written before this change still parse cleanly.
//
// Value()/String() emit this layout only when t.Nanosecond() >= 1ms.
// Times that fall exactly on a second boundary (including every value
// written by older builds and by xorm's auto-timestamps) round-trip with
// the legacy `time.DateTime` layout, so SQL `WHERE updated = ?` text
// comparisons against those rows still match.
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

// parseDBTimeString accepts either the millisecond layout
// (`2006-01-02 15:04:05.000`) or the legacy second layout (`time.DateTime`),
// so values written by older builds still round-trip correctly after the
// upgrade.
func parseDBTimeString(s string) (time.Time, error) {
	if t, err := time.Parse(dbTimeMillisLayout, s); err == nil {
		return t, nil
	}
	return time.Parse(time.DateTime, s)
}
