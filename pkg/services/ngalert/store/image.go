package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	imageExpirationDuration = 24 * time.Hour
)

type ImageStore interface {
	// GetImage returns the image with the token. It returns ErrImageNotFound
	// if the image has expired or if an image with the token does not exist.
	GetImage(ctx context.Context, token string) (*models.Image, error)

	// GetImageByURL looks for a image by its URL. It returns ErrImageNotFound
	// if the image has expired or if there is no image associated with the URL.
	GetImageByURL(ctx context.Context, url string) (*models.Image, error)

	// GetImages returns all images that match the tokens. If one or more images
	// have expired or do not exist then it also returns the unmatched tokens
	// and an ErrImageNotFound error.
	GetImages(ctx context.Context, tokens []string) ([]models.Image, []string, error)

	// SaveImage saves the image or returns an error.
	SaveImage(ctx context.Context, img *models.Image) error

	// URLExists takes a URL and returns a boolean indicating whether or not
	// we have an image for that URL.
	URLExists(ctx context.Context, url string) (bool, error)
}

type ImageAdminStore interface {
	ImageStore

	// DeleteExpiredImages deletes expired images. It returns the number of deleted images
	// or an error.
	DeleteExpiredImages(context.Context) (int64, error)
}

func (st DBstore) GetImage(ctx context.Context, token string) (*models.Image, error) {
	var image models.Image
	if err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Where("token = ? AND expires_at > ?", token, TimeNow().UTC()).Get(&image)
		if err != nil {
			return fmt.Errorf("failed to get image: %w", err)
		} else if !exists {
			return models.ErrImageNotFound
		} else {
			return nil
		}
	}); err != nil {
		return nil, err
	}
	return &image, nil
}

func (st DBstore) GetImageByURL(ctx context.Context, url string) (*models.Image, error) {
	var image models.Image
	if err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Where("url = ? AND expires_at > ?", url, TimeNow().UTC()).Limit(1).Get(&image)
		if err != nil {
			return fmt.Errorf("failed to get image: %w", err)
		} else if !exists {
			return models.ErrImageNotFound
		} else {
			return nil
		}
	}); err != nil {
		return nil, err
	}
	return &image, nil
}

func (st DBstore) URLExists(ctx context.Context, url string) (bool, error) {
	var exists bool
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		ok, err := sess.Table("alert_image").Where("url = ? AND expires_at > ?", url, TimeNow().UTC()).Exist()
		if err != nil {
			return err
		}
		exists = ok
		return nil
	})
	return exists, err
}

func (st DBstore) GetImages(ctx context.Context, tokens []string) ([]models.Image, []string, error) {
	var images []models.Image
	if err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.In("token", tokens).Where("expires_at > ?", TimeNow().UTC()).Find(&images)
	}); err != nil {
		return nil, nil, err
	}
	if len(images) < len(tokens) {
		return images, unmatchedTokens(tokens, images), models.ErrImageNotFound
	}
	return images, nil, nil
}

func (st DBstore) SaveImage(ctx context.Context, img *models.Image) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if img.ID == 0 {
			// If the ID is zero then this is a new image. It needs a token, a created timestamp
			// and an expiration time. The expiration time of the image is derived from the created
			// timestamp rather than the current time as it helps assert that the expiration time
			// has the intended duration in tests.
			token, err := uuid.NewRandom()
			if err != nil {
				return fmt.Errorf("failed to create token: %w", err)
			}
			img.Token = token.String()
			img.CreatedAt = TimeNow().UTC()
			img.ExpiresAt = img.CreatedAt.Add(imageExpirationDuration)
			if _, err := sess.Insert(img); err != nil {
				return fmt.Errorf("failed to insert image: %w", err)
			}
		} else {
			// Check if the image exists as some databases return 0 rows affected if
			// no changes were made
			if ok, err := sess.Where("id = ?", img.ID).ForUpdate().Exist(&models.Image{}); err != nil {
				return fmt.Errorf("failed to check if image exists: %v", err)
			} else if !ok {
				return models.ErrImageNotFound
			}

			// Do not reset the expiration time as it can be extended with ExtendDuration
			if _, err := sess.ID(img.ID).Update(img); err != nil {
				return fmt.Errorf("failed to update image: %v", err)
			}
		}
		return nil
	})
}

func (st DBstore) DeleteExpiredImages(ctx context.Context) (int64, error) {
	var n int64
	if err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.Where("expires_at < ?", TimeNow().UTC()).Delete(&models.Image{})
		if err != nil {
			return fmt.Errorf("failed to delete expired images: %w", err)
		}
		n = rows
		return nil
	}); err != nil {
		return -1, err
	}
	return n, nil
}

// unmatchedTokens returns the tokens that were not matched to an image.
func unmatchedTokens(tokens []string, images []models.Image) []string {
	matched := make(map[string]struct{})
	for _, image := range images {
		matched[image.Token] = struct{}{}
	}
	unmatched := make([]string, 0, len(tokens))
	for _, token := range tokens {
		if _, ok := matched[token]; !ok {
			unmatched = append(unmatched, token)
		}
	}
	return unmatched
}
