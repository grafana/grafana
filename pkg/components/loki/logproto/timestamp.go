package logproto

import (
	"errors"
	"strconv"
	"time"

	"github.com/gogo/protobuf/types"
)

const (
	// Seconds field of the earliest valid Timestamp.
	// This is time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC).Unix().
	minValidSeconds = -62135596800
	// Seconds field just after the latest valid Timestamp.
	// This is time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC).Unix().
	maxValidSeconds = 253402300800
)

// validateTimestamp determines whether a Timestamp is valid.
// A valid timestamp represents a time in the range
// [0001-01-01, 10000-01-01) and has a Nanos field
// in the range [0, 1e9).
//
// If the Timestamp is valid, validateTimestamp returns nil.
// Otherwise, it returns an error that describes
// the problem.
//
// Every valid Timestamp can be represented by a time.Time, but the converse is not true.
func validateTimestamp(ts *types.Timestamp) error {
	if ts == nil {
		return errors.New("timestamp: nil Timestamp")
	}
	if ts.Seconds < minValidSeconds {
		return errors.New("timestamp: " + formatTimestamp(ts) + " before 0001-01-01")
	}
	if ts.Seconds >= maxValidSeconds {
		return errors.New("timestamp: " + formatTimestamp(ts) + " after 10000-01-01")
	}
	if ts.Nanos < 0 || ts.Nanos >= 1e9 {
		return errors.New("timestamp: " + formatTimestamp(ts) + ": nanos not in range [0, 1e9)")
	}
	return nil
}

// formatTimestamp is equivalent to fmt.Sprintf("%#v", ts)
// but avoids the escape incurred by using fmt.Sprintf, eliminating
// unnecessary heap allocations.
func formatTimestamp(ts *types.Timestamp) string {
	if ts == nil {
		return "nil"
	}

	seconds := strconv.FormatInt(ts.Seconds, 10)
	nanos := strconv.FormatInt(int64(ts.Nanos), 10)
	return "&types.Timestamp{Seconds: " + seconds + ",\nNanos: " + nanos + ",\n}"
}

func SizeOfStdTime(t time.Time) int {
	ts, err := timestampProto(t)
	if err != nil {
		return 0
	}
	return ts.Size()
}

func StdTimeMarshalTo(t time.Time, data []byte) (int, error) {
	ts, err := timestampProto(t)
	if err != nil {
		return 0, err
	}
	return ts.MarshalTo(data)
}

func StdTimeUnmarshal(t *time.Time, data []byte) error {
	ts := &types.Timestamp{}
	if err := ts.Unmarshal(data); err != nil {
		return err
	}
	tt, err := timestampFromProto(ts)
	if err != nil {
		return err
	}
	*t = tt
	return nil
}

func timestampFromProto(ts *types.Timestamp) (time.Time, error) {
	// Don't return the zero value on error, because corresponds to a valid
	// timestamp. Instead return whatever time.Unix gives us.
	var t time.Time
	if ts == nil {
		t = time.Unix(0, 0).UTC() // treat nil like the empty Timestamp
	} else {
		t = time.Unix(ts.Seconds, int64(ts.Nanos)).UTC()
	}
	return t, validateTimestamp(ts)
}

func timestampProto(t time.Time) (types.Timestamp, error) {
	ts := types.Timestamp{
		Seconds: t.Unix(),
		Nanos:   int32(t.Nanosecond()),
	}
	return ts, validateTimestamp(&ts)
}
