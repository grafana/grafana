package shorturlimpl

import (
	"context"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
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

func (s ShortURLService) List(ctx context.Context, orgID int64) ([]*shorturls.ShortUrl, error) {
	return s.SQLStore.List(ctx, orgID)
}

func (s ShortURLService) CreateShortURL(ctx context.Context, user *user.SignedInUser, cmd *dtos.CreateShortURLCmd) (*shorturls.ShortUrl, error) {
	relPath := strings.TrimSpace(cmd.Path)

	if path.IsAbs(relPath) {
		return nil, shorturls.ErrShortURLAbsolutePath.Errorf("expected relative path: %s", relPath)
	}
	if strings.Contains(relPath, "../") {
		return nil, shorturls.ErrShortURLInvalidPath.Errorf("path cannot contain '../': %s", relPath)
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	} else {
		// Ensure the UID is valid
		if !util.IsValidShortUID(uid) {
			return nil, shorturls.ErrShortURLBadRequest.Errorf("invalid UID: %s", uid)
		}

		// Check if the UID already exists
		existingShortURL, err := s.SQLStore.Get(ctx, user, uid)
		if err != nil {
			if !shorturls.ErrShortURLNotFound.Is(err) {
				return nil, shorturls.ErrShortURLInternal.Errorf("failed to check existing short URL: %w", err)
			}
		}
		if existingShortURL != nil {
			// If the UID already exists, we return an error
			return nil, shorturls.ErrShortURLConflict.Errorf("short URL with UID '%s' already exists", uid)
		}
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

func (s ShortURLService) ConvertShortURLToDTO(shortURL *shorturls.ShortUrl, appURL string) *dtos.ShortURL {
	url := fmt.Sprintf("%s/goto/%s?orgId=%d", strings.TrimSuffix(appURL, "/"), shortURL.Uid, shortURL.OrgId)

	return &dtos.ShortURL{
		UID: shortURL.Uid,
		URL: url,
	}
}
