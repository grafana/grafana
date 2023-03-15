package retryer

import (
	"errors"
	"time"
)

type RetrySignal = int

const (
	FuncFailure RetrySignal = iota
	FuncComplete
	FuncError
)

// Retry retries the provided function using exponential backoff, starting with `minDelay` between attempts, and increasing to
// `maxDelay` after each failure. Stops when the provided function returns `FuncComplete`, or `maxRetries` is reached.
func Retry(body func() (RetrySignal, error), maxRetries int, minDelay time.Duration, maxDelay time.Duration) error {
	currentDelay := minDelay
	ticker := time.NewTicker(currentDelay)
	defer ticker.Stop()

	retries := 0
	for range ticker.C {
		response, err := body()
		if err != nil {
			return err
		}

		switch response {
		case FuncFailure:
			currentDelay = minDuration(currentDelay*2, maxDelay)
			ticker.Reset(currentDelay)
			retries++
		case FuncComplete:
			return nil
		}

		if retries >= maxRetries {
			return errors.New("max retries exceeded")
		}
	}

	return nil
}

func minDuration(a time.Duration, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
