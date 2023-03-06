package models

import (
	"errors"
	"time"
)

var (
	// ErrImageNotFound is returned when the image does not exist.
	ErrImageNotFound = errors.New("image not found")
)

type Image struct {
	ID        int64     `xorm:"pk autoincr 'id'"`
	Token     string    `xorm:"token"`
	Path      string    `xorm:"path"`
	URL       string    `xorm:"url"`
	CreatedAt time.Time `xorm:"created_at"`
	ExpiresAt time.Time `xorm:"expires_at"`
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
