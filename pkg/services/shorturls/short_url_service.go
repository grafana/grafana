package shorturls

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	registry.RegisterService(&ShortURLService{})
}

type ShortURLService struct {
	SQLStore *sqlstore.SqlStore `inject:""`
}

func (s *ShortURLService) Init() error {
	return nil
}

func (s ShortURLService) GetFullURLByUID(user *models.SignedInUser, uid string) (string, error) {
	var shortURL models.ShortUrl
	ctx := context.Background()
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
		return "", err
	}

	return shortURL.Path, nil
}

func (s ShortURLService) CreateShortURL(user *models.SignedInUser, path string) (string, error) {
	now := time.Now().Unix()
	shortURL := models.ShortUrl{
		OrgId:     user.OrgId,
		Uid:       util.GenerateShortUID(),
		Path:      path,
		CreatedBy: user.UserId,
		CreatedAt: now,
	}

	ctx := context.Background()
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Insert(&shortURL)
		return err
	})
	if err != nil {
		return "", err
	}

	return shortURL.Uid, nil
}
