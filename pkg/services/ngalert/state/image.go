package state

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
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

func isRetryableError(err error) bool {
	return errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, rendering.ErrServerTimeout) ||
		errors.Is(err, rendering.ErrTimeout)
}

func newImageAttempt(img *models.Image, err error) *ImageAttempt {
	if img == nil && err == nil {
		return nil
	}
	if err != nil {
		return &ImageAttempt{Image: models.Image{CreatedAt: time.Now()}, Error: err}
	}
	return &ImageAttempt{Image: *img}
}

type ImageAttempt struct {
	models.Image
	Error               error
	consecutiveTimeouts int
	// Keep the last successful capture available for notifications when a refresh fails.
	previousImage *models.Image
}

func (a *ImageAttempt) notificationImage() *models.Image {
	if a == nil {
		return nil
	}
	if a.Error == nil {
		return &a.Image
	}
	return a.previousImage
}

func imageCaptureBackoffDuration(consecutiveTimeouts int) time.Duration {
	if consecutiveTimeouts <= 0 {
		return 0
	}
	shift := min(consecutiveTimeouts-1, imageCaptureBackoffMaxShift)
	return min(imageCaptureBackoffBase<<shift, imageCaptureBackoffMax)
}

func (a *ImageAttempt) withPrevious(previous *ImageAttempt) *ImageAttempt {
	if a == nil {
		return newImageAttempt(previous.notificationImage(), nil)
	}
	if a.Error == nil {
		return a
	}
	// Capture results are shared by all instances in an evaluation, while retry
	// history belongs to each instance. Copies of State also share their image.
	result := *a
	result.previousImage = previous.notificationImage()
	if !isRetryableError(a.Error) {
		return &result
	}
	result.consecutiveTimeouts = 1
	if previous != nil {
		result.consecutiveTimeouts = min(previous.consecutiveTimeouts+1, imageCaptureBackoffMaxShift+1)
	}
	result.ExpiresAt = result.CreatedAt.Add(imageCaptureBackoffDuration(result.consecutiveTimeouts))
	return &result
}
