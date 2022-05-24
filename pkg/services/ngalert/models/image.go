package models

import (
	"errors"
	"time"
)

// ErrImageNotFound is returned when the image does not exist.
var ErrImageNotFound = errors.New("image not found")

type Image struct {
	ID        int64     `xorm:"pk autoincr 'id'"`
	Token     string    `xorm:"token"`
	Path      string    `xorm:"path"`
	URL       string    `xorm:"url"`
	CreatedAt time.Time `xorm:"created_at"`
	ExpiresAt time.Time `xorm:"expires_at"`
}

// A XORM interface that lets us clean up our SQL session definition.
func (i *Image) TableName() string {
	return "alert_image"
}
