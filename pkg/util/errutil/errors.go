package errutil

import (
	"fmt"
)

// Error is the base error type for errors within Grafana, extending
// the Go error type with Grafana specific metadata to reduce
// boilerplate error handling for status codes and internationalization
// support.
//
// Error implements Unwrap and Is to natively support Go 1.13 style
// errors as described in https://go.dev/blog/go1.13-errors .
type Error struct {
	Type       Status
	Message    string
	Underlying error
}

// Error implements error.
func (e Error) Error() string {
	return e.Message
}

// Unwrap is used by errors.As to iterate over the sequence of
// underlying errors until a matching type is found.
func (e Error) Unwrap() error {
	return e.Underlying
}

// Is is used by errors.Is to allow for custom definitions of equality
// between two errors.
func (e Error) Is(other error) bool {
	o, ok := other.(Error)
	if !ok {
		return false
	}

	return o.Type == e.Type && o.Error() == e.Error()
}

// Wrap is a simple wrapper around fmt.Errorf that wraps errors.
func Wrap(message string, err error) error {
	if err == nil {
		return nil
	}

	return fmt.Errorf("%v: %w", message, err)
}

// Wrapf is a simple wrapper around fmt.Errorf that wraps errors.
// Wrapf allows you to send a format and args instead of just a message.
func Wrapf(err error, message string, a ...interface{}) error {
	if err == nil {
		return nil
	}

	return Wrap(fmt.Sprintf(message, a...), err)
}
