package legacysql

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type DBTime struct {
	time.Time
}

func NewDBTime(t time.Time) DBTime {
	return DBTime{Time: t}
}

func (t DBTime) Value() (driver.Value, error) {
	if t.IsZero() {
		return nil, nil
	}

	return t.Format(time.DateTime), nil
}

func (t DBTime) String() string {
	if t.IsZero() {
		return ""
	}

	return t.Format(time.DateTime)
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
		parsedTime, err = time.Parse(time.DateTime, string(v))
	case string:
		parsedTime, err = time.Parse(time.DateTime, v)
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
