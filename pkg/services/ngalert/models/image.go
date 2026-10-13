package models

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrImageNotFound is returned when the image does not exist or is expired.
	ErrImageNotFound = errors.New("image not found")

	// ErrImageDataUnavailable is returned when image data is unavailable. Usually because the image is missing a path.
	ErrImageDataUnavailable = errors.New("image data is unavailable")
)

type Image struct {
	ID        int64         `xorm:"pk autoincr 'id'"`
	Token     string        `xorm:"token"`
	Path      string        `xorm:"path"`
	URL       string        `xorm:"url"`
	CreatedAt time.Time     `xorm:"created_at"`
	ExpiresAt time.Time     `xorm:"expires_at"`
	Capture   *ImageCapture `xorm:"-" json:"-"`
}

// ImageCapture publishes a background capture result to every alert sharing its token.
type ImageCapture struct {
	done        chan struct{}
	image       Image
	err         error
	completedAt time.Time
}

// NewImageCapture returns a handle and its producer, which must be called exactly once with the completion time.
func NewImageCapture() (*ImageCapture, func(Image, error, time.Time)) {
	capture := &ImageCapture{done: make(chan struct{})}
	return capture, func(image Image, err error, completedAt time.Time) {
		capture.image, capture.err, capture.completedAt = image, err, completedAt
		close(capture.done)
	}
}

// CompletedAt anchors retries to completion rather than the next rule evaluation.
func (c *ImageCapture) CompletedAt() time.Time {
	select {
	case <-c.done:
		return c.completedAt
	default:
		return time.Time{}
	}
}

// Result is nonblocking. The closed channel publishes the immutable result safely.
func (c *ImageCapture) Result() (Image, error, bool) {
	select {
	case <-c.done:
		return c.image, c.err, true
	default:
		return Image{}, nil, false
	}
}

// Wait lets synchronous callers share a capture started before the flag was disabled.
func (c *ImageCapture) Wait(ctx context.Context) (Image, error) {
	select {
	case <-c.done:
		return c.image, c.err
	case <-ctx.Done():
		return Image{}, ctx.Err()
	}
}

// ExtendDuration extends the expiration time of the image. It can shorten
// the duration of the image if d is negative.
func (i *Image) ExtendDuration(d time.Duration) {
	i.ExpiresAt = i.ExpiresAt.Add(d)
}

// HasExpired returns true if the image has expired.
func (i *Image) HasExpired() bool {
	return timeNow().After(i.ExpiresAt)
}

// HasPath returns true if the image has a path on disk.
func (i *Image) HasPath() bool {
	return i.Path != ""
}

// HasURL returns true if the image has a URL.
func (i *Image) HasURL() bool {
	return i.URL != ""
}

// A XORM interface that defines the used table for this struct.
func (i *Image) TableName() string {
	return "alert_image"
}
