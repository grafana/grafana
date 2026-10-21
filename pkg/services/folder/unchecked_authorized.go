package folder

import (
	"context"
	"errors"
)

// ErrUncheckedDeleteNotAuthorized means an Unchecked RegistryService method was called without the
// WithUncheckedDeleteAuthorized marker -- a wiring bug in the caller, not a permission problem, so
// it's deliberately distinct from ErrAccessDenied.
var ErrUncheckedDeleteNotAuthorized = errors.New("unchecked delete called without going through a sanctioned entry point")

type uncheckedDeleteAuthorizedKey struct{}

// WithUncheckedDeleteAuthorized marks ctx as authorized for an Unchecked RegistryService delete,
// either because a checked caller just ran its own equivalent permission check, or because the
// caller (e.g. a standalone folder apiserver's cascade delete) already authorized the requester a
// different way. An Unchecked method checks for this marker so it can't run for any other caller.
func WithUncheckedDeleteAuthorized(ctx context.Context) context.Context {
	return context.WithValue(ctx, uncheckedDeleteAuthorizedKey{}, true)
}

// IsUncheckedDeleteAuthorized reports whether ctx carries the marker set by WithUncheckedDeleteAuthorized.
func IsUncheckedDeleteAuthorized(ctx context.Context) bool {
	v, _ := ctx.Value(uncheckedDeleteAuthorizedKey{}).(bool)
	return v
}
