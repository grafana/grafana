package channels

import (
	"context"
	"errors"
	"time"
)

var (
	ErrImageNotFound = errors.New("image not found")
)

type Image struct {
	Token     string
	Path      string
	URL       string
	CreatedAt time.Time
}

func (i Image) HasURL() bool {
	return i.URL != ""
}

type ImageStore interface {
	GetImage(ctx context.Context, token string) (*Image, error)
}
