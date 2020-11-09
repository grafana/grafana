package shorturls

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

var getTime = time.Now

func init() {
	registry.RegisterService(&ShortURLService{})
}

type ShortURLService struct {
	SQLStore *sqlstore.SqlStore `inject:""`
}

func (s *ShortURLService) Init() error {
	return nil
}

func (s ShortURLService) GetShortURLByUID(ctx context.Context, user *models.SignedInUser, uid string) (*models.ShortUrl, error) {
	var shortURL models.ShortUrl
	err := s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		exists, err := dbSession.Where("org_id=? AND uid=?", user.OrgId, uid).Get(&shortURL)
		if err != nil {
			return err
		}
		if !exists {
			return models.ErrShortURLNotFound
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
	return s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		_, err := dbSession.ID(shortURL.Id).Update(shortURL)
		if err != nil {
			return err
		}

		return nil
	})
}

func (s ShortURLService) CreateShortURL(ctx context.Context, user *models.SignedInUser, path string) (*models.ShortUrl, error) {
	now := time.Now().Unix()
	shortURL := models.ShortUrl{
		OrgId:     user.OrgId,
		Uid:       util.GenerateShortUID(),
		Path:      path,
		CreatedBy: user.UserId,
		CreatedAt: now,
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Insert(&shortURL)
		return err
	})
	if err != nil {
		return nil, err
	}

	return &shortURL, nil
}

func (s ShortURLService) DeleteStaleShortURLs(ctx context.Context, cmd *models.DeleteShortUrlCommand) error {
	return s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		var rawSql = "DELETE FROM short_url WHERE created_at <= ? AND (last_seen_at IS NULL OR last_seen_at = 0)"

		if result, err := session.Exec(rawSql, cmd.OlderThan.Unix()); err != nil {
			return err
		} else if cmd.NumDeleted, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}
