package kindsys

import "errors"

// TODO consider rewriting with https://github.com/cockroachdb/errors

var (
	// ErrValueNotExist indicates that a necessary CUE value did not exist.
	ErrValueNotExist = errors.New("cue value does not exist")

	// ErrValueNotAKind indicates that a provided CUE value is not any variety of
	// Interface. This is almost always an end-user error - they oops'd and provided the
	// wrong path, file, etc.
	ErrValueNotAKind = errors.New("not a kind")
)

func ewrap(actual, is error) error {
	return &errPassthrough{
		actual: actual,
		is:     is,
	}
}

type errPassthrough struct {
	actual error
	is     error
}

func (e *errPassthrough) Is(err error) bool {
	return errors.Is(err, e.actual) || errors.Is(err, e.is)
}

func (e *errPassthrough) Error() string {
	return e.actual.Error()
}
