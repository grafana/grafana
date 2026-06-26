package shorturls

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type Service interface {
	GetShortURLByUID(ctx context.Context, user *user.SignedInUser, uid string) (*ShortUrl, error)
	CreateShortURL(ctx context.Context, user *user.SignedInUser, path string) (*ShortUrl, error)
	UpdateLastSeenAt(ctx context.Context, shortURL *ShortUrl) error
	DeleteStaleShortURLs(ctx context.Context, cmd *DeleteShortUrlCommand) error
}
