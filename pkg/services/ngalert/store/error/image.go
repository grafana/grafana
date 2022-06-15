package error

import (
	"errors"
)

var (
	// ErrImageNotFound is returned when the image does not exist.
	ErrImageNotFound     = errors.New("image not found")
	ErrImagesUnavailable = errors.New("images are unavailable")
)
