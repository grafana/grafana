package errutil

import (
	"errors"
	"fmt"
)

// ErrorBase represents the static information about a specific error.
// The Reason is used to determine the status code that should be
// returned for the error, and the MessageID is passed to the caller
// to serve as the base for user facing error messages.
//
// MessageID should be structured as component.error-brief, for example
//   login.failed-authentication
//   dashboards.validation-error
//   dashboards.uid-already-exists
type ErrorBase struct {
	Reason    StatusReason
	MessageID string
}

// Base help with the initialization of ErrorBase.
func Base(reason StatusReason, msgID string) ErrorBase {
	return ErrorBase{
		Reason:    reason,
		MessageID: msgID,
	}
}

// Errorf creates a new Error with the Reason and MessageID from
// ErrorBase, and Message and Underlying will be populated using
// the rules of fmt.Errorf.
func (e ErrorBase) Errorf(format string, args ...interface{}) Error {
	err := fmt.Errorf(format, args...)

	return Error{
		Reason:     e.Reason,
		Message:    err.Error(),
		MessageID:  e.MessageID,
		Underlying: errors.Unwrap(err),
	}
}

// Error is the error type for errors within Grafana, extending
// the Go error type with Grafana specific metadata to reduce
// boilerplate error handling for status codes and internationalization
// support.
//
// Error implements Unwrap and Is to natively support Go 1.13 style
// errors as described in https://go.dev/blog/go1.13-errors .
type Error struct {
	Reason     StatusReason
	Message    string
	MessageID  string
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

	return o.Reason == e.Reason && o.MessageID == e.MessageID && o.Error() == e.Error()
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
