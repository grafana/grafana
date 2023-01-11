package shorturls

import (
	"context"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/models/errs"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

var getTime = time.Now

func ProvideService(sqlStore db.DB) *ShortURLService {
	return &ShortURLService{
		SQLStore: sqlStore,
	}
}

type Service interface {
	GetShortURLByUID(ctx context.Context, user *user.SignedInUser, uid string) (*models.ShortUrl, error)
	CreateShortURL(ctx context.Context, user *user.SignedInUser, path string) (*models.ShortUrl, error)
	UpdateLastSeenAt(ctx context.Context, shortURL *models.ShortUrl) error
	DeleteStaleShortURLs(ctx context.Context, cmd *models.DeleteShortUrlCommand) error
}

type ShortURLService struct {
	SQLStore db.DB
}

func (s ShortURLService) GetShortURLByUID(ctx context.Context, user *user.SignedInUser, uid string) (*models.ShortUrl, error) {
	var shortURL models.ShortUrl
	err := s.SQLStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("org_id=? AND uid=?", user.OrgID, uid).Get(&shortURL)
		if err != nil {
			return err
		}
		if !exists {
			return errs.ErrShorturlNotFound.Errorf("short URL not found")
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return &shortURL, nil
}

func (s ShortURLService) UpdateLastSeenAt(ctx context.Context, shortURL *models.ShortUrl) error {
	shortURL.LastSeenAt = getTime().Unix()
	return s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		_, err := dbSession.ID(shortURL.Id).Update(shortURL)
		if err != nil {
			return err
		}

		return nil
	})
}

func (s ShortURLService) CreateShortURL(ctx context.Context, user *user.SignedInUser, relPath string) (*models.ShortUrl, error) {
	relPath = strings.TrimSpace(relPath)

	if path.IsAbs(relPath) {
		return nil, errs.ErrShorturlAbsolutePath.Errorf("expected relative path: %s", relPath)
	}
	if strings.Contains(relPath, "../") {
		return nil, errs.ErrShorturlInvalidPath.Errorf("path cannot contain '../': %s", relPath)
	}

	now := time.Now().Unix()
	shortURL := models.ShortUrl{
		OrgId:     user.OrgID,
		Uid:       util.GenerateShortUID(),
		Path:      relPath,
		CreatedBy: user.UserID,
		CreatedAt: now,
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Insert(&shortURL)
		return err
	})
	if err != nil {
		return nil, errs.ErrShorturlInternal.Errorf("failed to insert shorturl: %w", err)
	}

	return &shortURL, nil
}

func (s ShortURLService) DeleteStaleShortURLs(ctx context.Context, cmd *models.DeleteShortUrlCommand) error {
	return s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		var rawSql = "DELETE FROM short_url WHERE created_at <= ? AND (last_seen_at IS NULL OR last_seen_at = 0)"

		if result, err := session.Exec(rawSql, cmd.OlderThan.Unix()); err != nil {
			return err
		} else if cmd.NumDeleted, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}

var _ Service = &ShortURLService{}
