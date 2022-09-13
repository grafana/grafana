package errutil

import (
	"errors"
	"fmt"
)

// Base represents the static information about a specific error.
// Always use NewBase to create new instances of Base.
type Base struct {
	// Because Base is typically instantiated as a package or global
	// variable, having private members reduces the probability of a
	// bug messing with the error base.
	reason        StatusReason
	messageID     string
	publicMessage string
	logLevel      LogLevel
}

// NewBase initializes a Base that is used to construct Error:s.
// The reason is used to determine the status code that should be
// returned for the error, and the msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.error-brief, for example
//
//	login.failed-authentication
//	dashboards.validation-error
//	dashboards.uid-already-exists
func NewBase(reason StatusReason, msgID string, opts ...BaseOpt) Base {
	b := Base{
		reason:    reason,
		messageID: msgID,
		logLevel:  reason.Status().LogLevel(),
	}

	for _, opt := range opts {
		b = opt(b)
	}

	return b
}

type BaseOpt func(Base) Base

// WithLogLevel sets a custom log level for all errors instantiated from
// this Base.
//
// Used as a functional option to NewBase.
func WithLogLevel(lvl LogLevel) BaseOpt {
	return func(b Base) Base {
		b.logLevel = lvl
		return b
	}
}

// WithPublicMessage sets the default public message that will be used
// for errors based on this Base.
//
// Used as a functional option to NewBase.
func WithPublicMessage(message string) BaseOpt {
	return func(b Base) Base {
		b.publicMessage = message
		return b
	}
}

// Errorf creates a new Error with the Reason and MessageID from
// Base, and Message and Underlying will be populated using
// the rules of fmt.Errorf.
func (b Base) Errorf(format string, args ...interface{}) Error {
	err := fmt.Errorf(format, args...)

	return Error{
		Reason:        b.reason,
		LogMessage:    err.Error(),
		PublicMessage: b.publicMessage,
		MessageID:     b.messageID,
		Underlying:    errors.Unwrap(err),
		LogLevel:      b.logLevel,
	}
}

// Error makes Base implement the error type. Relying on this is
// discouraged, as the Error type can carry additional information
// that's valuable when debugging.
func (b Base) Error() string {
	return b.Errorf("").Error()
}

func (b Base) Status() StatusReason {
	if b.reason == nil {
		return StatusUnknown
	}
	return b.reason.Status()
}

// Is validates that an Error has the same reason and messageID as the
// Base.
func (b Base) Is(err error) bool {
	// The linter complains that it wants to use errors.As because it
	// handles unwrapping, we don't want to do that here since we want
	// to validate the equality between the two objects.
	// errors.Is handles the unwrapping, should you want it.
	//nolint:errorlint
	base, isBase := err.(Base)
	//nolint:errorlint
	gfErr, isGrafanaError := err.(Error)

	switch {
	case isGrafanaError:
		return b.reason == gfErr.Reason && b.messageID == gfErr.MessageID
	case isBase:
		return b.reason == base.reason && b.messageID == base.messageID
	default:
		return false
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
	Reason        StatusReason
	MessageID     string
	LogMessage    string
	Underlying    error
	PublicMessage string
	PublicPayload map[string]interface{}
	LogLevel      LogLevel
}

// MarshalJSON returns an error, we do not want raw Error:s being
// marshaled into JSON.
//
// Use Public to convert the Error into a PublicError which can be
// marshaled. This is not done automatically, as that conversion is
// lossy.
func (e Error) MarshalJSON() ([]byte, error) {
	return nil, fmt.Errorf("errutil.Error cannot be directly marshaled into JSON")
}

// Error implements the error interface.
func (e Error) Error() string {
	return fmt.Sprintf("[%s] %s", e.MessageID, e.LogMessage)
}

// Unwrap is used by errors.As to iterate over the sequence of
// underlying errors until a matching type is found.
func (e Error) Unwrap() error {
	return e.Underlying
}

// Is is used by errors.Is to allow for custom definitions of equality
// between two errors.
func (e Error) Is(other error) bool {
	// The linter complains that it wants to use errors.As because it
	// handles unwrapping, we don't want to do that here since we want
	// to validate the equality between the two objects.
	// errors.Is handles the unwrapping, should you want it.
	//nolint:errorlint
	o, isGrafanaError := other.(Error)
	//nolint:errorlint
	base, isBase := other.(Base)

	switch {
	case isGrafanaError:
		return o.Reason == e.Reason && o.MessageID == e.MessageID && o.Error() == e.Error()
	case isBase:
		return base.Is(e)
	default:
		return false
	}
}

// PublicError is derived from Error and only contains information
// available to the end user.
type PublicError struct {
	StatusCode int                    `json:"statusCode"`
	MessageID  string                 `json:"messageId"`
	Message    string                 `json:"message,omitempty"`
	Extra      map[string]interface{} `json:"extra,omitempty"`
}

// Public returns a subset of the error with non-sensitive information
// that may be relayed to the caller.
func (e Error) Public() PublicError {
	message := e.PublicMessage
	if message == "" {
		if e.Reason == StatusUnknown {
			// The unknown status is equal to the empty string.
			message = string(StatusInternal)
		} else {
			message = string(e.Reason.Status())
		}
	}

	return PublicError{
		StatusCode: e.Reason.Status().HTTPStatus(),
		MessageID:  e.MessageID,
		Message:    message,
		Extra:      e.PublicPayload,
	}
}
