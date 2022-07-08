package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ImageStore interface {
	// GetImage returns the image with the token or ErrImageNotFound.
	GetImage(ctx context.Context, token string) (*models.Image, error)

	// GetImages returns all images that match the tokens. If one or more
	// tokens does not exist then it also returns ErrImageNotFound.
	GetImages(ctx context.Context, tokens []string) ([]models.Image, error)

	// SaveImage saves the image or returns an error.
	SaveImage(ctx context.Context, img *models.Image) error
}

func (st DBstore) GetImage(ctx context.Context, token string) (*models.Image, error) {
	var img models.Image
	if err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("token = ?", token).Get(&img)
		if err != nil {
			return fmt.Errorf("failed to get image: %w", err)
		}
		if !exists {
			return models.ErrImageNotFound
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return &img, nil
}

func (st DBstore) GetImages(ctx context.Context, tokens []string) ([]models.Image, error) {
	var imgs []models.Image
	if err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.In("token", tokens).Find(&imgs)
	}); err != nil {
		return nil, err
	}
	if len(imgs) < len(tokens) {
		return imgs, models.ErrImageNotFound
	}
	return imgs, nil
}

func (st DBstore) SaveImage(ctx context.Context, img *models.Image) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: Is this a good idea? Do we actually want to automatically expire
		// rows? See issue https://github.com/grafana/grafana/issues/49366
		img.ExpiresAt = TimeNow().Add(1 * time.Minute).UTC()
		if img.ID == 0 { // xorm will fill this field on Insert.
			token, err := uuid.NewRandom()
			if err != nil {
				return fmt.Errorf("failed to create token: %w", err)
			}
			img.Token = token.String()
			img.CreatedAt = TimeNow().UTC()
			if _, err := sess.Insert(img); err != nil {
				return fmt.Errorf("failed to insert screenshot: %w", err)
			}
		} else {
			affected, err := sess.ID(img.ID).Update(img)
			if err != nil {
				return fmt.Errorf("failed to update screenshot: %v", err)
			}
			if affected == 0 {
				return fmt.Errorf("update statement had no effect")
			}
		}
		return nil
	})
}

//nolint:unused
func (st DBstore) DeleteExpiredImages(ctx context.Context) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		n, err := sess.Where("expires_at < ?", TimeNow()).Delete(&models.Image{})
		if err != nil {
			return fmt.Errorf("failed to delete expired images: %w", err)
		}
		st.Logger.Info("deleted expired images", "n", n)
		return err
	})
}
