package state

import (
	"context"
	"errors"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/services/rendering"
)

const (
	// imageCaptureBackoffBase is the backoff after the first consecutive image-capture timeout.
	imageCaptureBackoffBase = 30 * time.Second
	// imageCaptureBackoffMax caps how long an image capture backs off after repeated timeouts.
	imageCaptureBackoffMax = 30 * time.Minute
	// imageCaptureBackoffMaxShift bounds the exponent so a long-firing alert with many
	// consecutive timeouts cannot shift imageCaptureBackoffBase into overflow or a negative
	// duration; 2^10 * 30s already exceeds imageCaptureBackoffMax, so the cap below is reached
	// well before this bound matters.
	imageCaptureBackoffMaxShift = 10
)

// IsRetryableError reports whether a failed image capture should be retried with
// backoff rather than on the next evaluation.
var IsRetryableError = func(err error) bool {
	return errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, rendering.ErrServerTimeout) ||
		errors.Is(err, rendering.ErrTimeout)
}

// CaptureAttempt records a failed image capture so the next attempt can back off.
// It belongs to the rule rather than to any one alert instance, so a single failure
// holds back every instance instead of each one retrying on its own.
type CaptureAttempt struct {
	lastAttempt time.Time
	retryCount  int
}

// newScreenshotAttempt records the outcome of a capture against the rule's previous attempt.
// A successful capture returns nil, which clears any outstanding backoff.
func newScreenshotAttempt(previous *CaptureAttempt, err error, c clock.Clock) *CaptureAttempt {
	if err == nil {
		return nil
	}
	attempt := &CaptureAttempt{lastAttempt: c.Now()}
	if !IsRetryableError(err) {
		// Errors that aren't retryable back off for zero time, so the next
		// evaluation tries again.
		return attempt
	}
	attempt.retryCount = 1
	if previous != nil {
		attempt.retryCount = min(previous.retryCount+1, imageCaptureBackoffMaxShift+1)
	}
	return attempt
}

func imageCaptureBackoffDuration(retryCount int) time.Duration {
	if retryCount <= 0 {
		return 0
	}
	shift := min(retryCount-1, imageCaptureBackoffMaxShift)
	return min(imageCaptureBackoffBase<<shift, imageCaptureBackoffMax)
}

// readyForRetry reports whether another capture may be attempted for the rule.
func (a *CaptureAttempt) readyForRetry(c clock.Clock) bool {
	if a == nil {
		return true
	}
	return !c.Now().Before(a.lastAttempt.Add(imageCaptureBackoffDuration(a.retryCount)))
}
