package converge

import "errors"

var (
	// ErrInvalidDeclaration is returned when the desired set is malformed: two
	// declarations at one key, an [Excluded] declaration with no reason, or a
	// reason on a declaration that is not excluded.
	// This error should only be used with errors.Is() for comparison.
	ErrInvalidDeclaration = errors.New("invalid declaration")

	// ErrIncompleteInput is returned when a hinted plan was asked for but the
	// supplied declarations and observations do not cover the hint closure.
	// Planning never proceeds on a partial window: a narrower scan is an
	// optimisation and must not change the outcome.
	// This error should only be used with errors.Is() for comparison.
	ErrIncompleteInput = errors.New("input does not cover hint closure")

	// ErrDepthExceeded is returned when a key implies a container deeper than
	// [ContainerConfig.MaxDepth].
	// This error should only be used with errors.Is() for comparison.
	ErrDepthExceeded = errors.New("container depth exceeded")

	// ErrAmbiguousIdentity is returned when two desired containers claim the
	// same identity, which would make a relocation indistinguishable from a
	// collision.
	// This error should only be used with errors.Is() for comparison.
	ErrAmbiguousIdentity = errors.New("ambiguous container identity")

	// ErrConflictingDeclaration is returned when a container is declared more
	// than once with incompatible identities or content. Bare existence merges
	// with a stated identity; two different stated identities do not.
	// This error should only be used with errors.Is() for comparison.
	ErrConflictingDeclaration = errors.New("conflicting declarations for one container")

	// ErrUnknownOp is returned by [Restrict] when a veto names an operation
	// that is not in the plan.
	// This error should only be used with errors.Is() for comparison.
	ErrUnknownOp = errors.New("veto names an operation not in the plan")
)

// KeyError identifies the key a planning failure concerns. Callers that report
// per-key problems to users should unwrap to it with errors.As.
type KeyError struct {
	Key Key
	Err error
}

func (e *KeyError) Error() string { return string(e.Key) + ": " + e.Err.Error() }
func (e *KeyError) Unwrap() error { return e.Err }

func keyErr(k Key, err error) error { return &KeyError{Key: k, Err: err} }
