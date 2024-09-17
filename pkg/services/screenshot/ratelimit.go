package screenshot

import (
	"context"
)

// A rate limiter restricts the number of screenshots that can be taken in parallel.
//
//go:generate mockgen -destination=ratelimit_mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot RateLimiter
type RateLimiter interface {
	// Do restricts the rate at which screenshots can be taken in parallel via screenshotFunc.
	// It returns the result of screenshotFunc, or an error if either the context deadline
	// has been exceeded or the context has been canceled while waiting its turn to call
	// screenshotFunc.
	Do(ctx context.Context, opts ScreenshotOptions, fn screenshotFunc) (*Screenshot, error)
}

// TokenRateLimiter is a rate limiter that uses a token bucket of fixed size N.
type TokenRateLimiter struct {
	tokens chan struct{}
}

func NewTokenRateLimiter(n int64) RateLimiter {
	return &TokenRateLimiter{
		tokens: make(chan struct{}, n),
	}
}

func (s *TokenRateLimiter) Do(ctx context.Context, opts ScreenshotOptions, fn screenshotFunc) (*Screenshot, error) {
	select {
	// the context is canceled
	case <-ctx.Done():
		return nil, ctx.Err()
	// there is a token available
	case s.tokens <- struct{}{}:
		defer func() { <-s.tokens }()
		return fn(ctx, opts)
	}
}

// NoOpRateLimiter is a no-op rate limiter that has no limits.
type NoOpRateLimiter struct{}

func (b *NoOpRateLimiter) Do(ctx context.Context, opts ScreenshotOptions, fn screenshotFunc) (*Screenshot, error) {
	return fn(ctx, opts)
}
