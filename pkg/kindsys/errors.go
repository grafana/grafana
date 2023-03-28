package kindsys

import "errors"

// TODO consider rewriting with https://github.com/cockroachdb/errors

var (
	// ErrValueNotExist indicates that a necessary CUE value did not exist.
	ErrValueNotExist = errors.New("cue value does not exist")

	// ErrValueNotAKind indicates that a provided CUE value is not any variety of
	// Kind. This is almost always a user error - they oops'd and provided the
	// wrong path, file, etc.
	ErrValueNotAKind = errors.New("not a kind")

	// ErrInvalidCUE indicates that the CUE representing the kind is invalid.
	ErrInvalidCUE = errors.New("CUE syntax error")
)
