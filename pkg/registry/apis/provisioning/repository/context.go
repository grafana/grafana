package repository

import (
	"context"
	"time"
)

// When writing values from history, we want the metadata to match Legacy grafana SQL
type CommitSignature struct {
	// Name represents a person name. It is an arbitrary string.
	Name string
	// Email is an email, but it cannot be assumed to be well-formed.
	Email string
	// When is the timestamp of the signature.
	When time.Time
}

type ctxAuthorKey struct{}

func WithAuthorSignature(ctx context.Context, sig CommitSignature) context.Context {
	return context.WithValue(ctx, ctxAuthorKey{}, sig)
}

func GetAuthorSignature(ctx context.Context) *CommitSignature {
	u, ok := ctx.Value(ctxAuthorKey{}).(CommitSignature)
	if ok {
		copy := u
		return &copy
	}
	return nil
}
