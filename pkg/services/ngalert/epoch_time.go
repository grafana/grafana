package ngalert

import (
	"fmt"
	"strconv"
	"time"
)

// EpochTime is a type of time.Time encoded as a unix epoch timestamp at second resolution in xorm and JSON.
// The database type should a BigInt. It encodes by fulfilling xorm's Conversion interface for operations like Get and Find.
// For JSON it encodes and decodes into a number.
type EpochTime time.Time

// FromDB deserializes time stored as a unix timestamp in the database to EpochTime,
// which has the underlying type of time.Time.
// FromDB is part of the xorm Conversion interface.
func (et *EpochTime) FromDB(b []byte) error {
	i, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil {
		return fmt.Errorf("error reading EpochTime type from database: %w", err)
	}

	*et = EpochTime(time.Unix(i, 0))

	return nil
}

// ToDB is not implemented as serialization is handled with manual SQL queries.
// ToDB is part of the xorm Conversion interface.
// This is never called, as it seems xorm's setColumnTime will call .Unix() if source type
// it time and the destination type a number type.
func (et *EpochTime) ToDB() ([]byte, error) {
	return nil, fmt.Errorf("database serialization of alerting ng Instance labels is not implemented")
}

// Time returns EpochTime as a time.Time.
// If the time is nil, a time.Time at epoch 0 is returned.
func (et *EpochTime) Time() time.Time {
	if et == nil {
		return time.Unix(0, 0)
	}
	return time.Time(*et)
}

func (et *EpochTime) String() string {
	return et.Time().String()
}

// UnmarshalJSON creates an EpochTime during de-serialization from JSON.
func (et *EpochTime) UnmarshalJSON(b []byte) error {
	return et.FromDB(b)
}

// MarshalJSON creates an Unix timestamp as a number during serialization to JSON.
func (et *EpochTime) MarshalJSON() ([]byte, error) {
	return []byte(strconv.FormatInt(et.Time().Unix(), 10)), nil
}
