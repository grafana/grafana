package shorturlimpl

import (
	"context"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/teris-io/shortid"
)

var getTime = time.Now

type ShortURLService struct {
	SQLStore store
}

func ProvideService(db db.DB) *ShortURLService {
	return &ShortURLService{
		SQLStore: &sqlStore{
			db: db,
		},
	}
}

func (s ShortURLService) GetShortURLByUID(ctx context.Context, user *user.SignedInUser, uid string) (*shorturls.ShortUrl, error) {
	return s.SQLStore.Get(ctx, user, uid)
}

func (s ShortURLService) UpdateLastSeenAt(ctx context.Context, shortURL *shorturls.ShortUrl) error {
	return s.SQLStore.Update(ctx, shortURL)
}

func (s ShortURLService) CreateShortURL(ctx context.Context, user *user.SignedInUser, relPath string) (*shorturls.ShortUrl, error) {
	relPath = strings.TrimSpace(relPath)

	if path.IsAbs(relPath) {
		return nil, shorturls.ErrShortURLAbsolutePath.Errorf("expected relative path: %s", relPath)
	}
	if strings.Contains(relPath, "../") {
		return nil, shorturls.ErrShortURLInvalidPath.Errorf("path cannot contain '../': %s", relPath)
	}

	uid, err := shortid.Generate()
	if err != nil {
		return nil, shorturls.ErrShortURLInternal.Errorf("failed to generate uid: %w", err)
	}

	now := time.Now().Unix()
	shortURL := shorturls.ShortUrl{
		OrgId:     user.OrgID,
		Uid:       uid,
		Path:      relPath,
		CreatedBy: user.UserID,
		CreatedAt: now,
	}

	if err := s.SQLStore.Insert(ctx, &shortURL); err != nil {
		return nil, shorturls.ErrShortURLInternal.Errorf("failed to insert shorturl: %w", err)
	}

	return &shortURL, nil
}

func (s ShortURLService) DeleteStaleShortURLs(ctx context.Context, cmd *shorturls.DeleteShortUrlCommand) error {
	return s.SQLStore.Delete(ctx, cmd)
}
