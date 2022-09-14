package screenshot

import (
	"context"
)

// TokenBucket is an interface for token buckets.
//
//go:generate mockgen -destination=token_mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot TokenBucket
type TokenBucket interface {
	// Get returns the next token or an error if the context is canceled
	// before a token is available.
	Get(context.Context) (bool, error)

	// Done returns a token to the bucket. It must not be called unless
	// a token has been acquired and the token is true.
	Done()
}

// FixedTokenBucket is a token bucket with a fixed size N.
type FixedTokenBucket struct {
	tokens chan struct{}
}

func NewFixedTokenBucket(n int64) TokenBucket {
	return &FixedTokenBucket{
		tokens: make(chan struct{}, n),
	}
}

func (s *FixedTokenBucket) Get(ctx context.Context) (bool, error) {
	select {
	// the context is canceled
	case <-ctx.Done():
		return false, ctx.Err()
	// there is a token available
	case s.tokens <- struct{}{}:
		return true, nil
	}
}

func (s *FixedTokenBucket) Done() {
	select {
	case <-s.tokens:
	default:
		panic("cannot return unaquired tokens")
	}
}

// NoOpTokenBucket is a no-op token bucket with unlimited tokens.
type NoOpTokenBucket struct{}

func (b *NoOpTokenBucket) Get(_ context.Context) (bool, error) {
	return true, nil
}

func (b *NoOpTokenBucket) Done() {}
