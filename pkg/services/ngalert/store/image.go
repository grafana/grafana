package store

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/gofrs/uuid"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var (
	// ErrImageNotFound is returned when the image does not exist.
	ErrImageNotFound = errors.New("image not found")
)

type Image struct {
	ID        int64     `xorm:"pk autoincr 'id'"`
	Token     string    `xorm:"token"`
	Path      string    `xorm:"path"`
	URL       string    `xorm:"url"`
	CreatedAt time.Time `xorm:"created_at"`
	ExpiresAt time.Time `xorm:"expires_at"`
}

// A XORM interface that lets us clean up our SQL session definition.
func (i *Image) TableName() string {
	return "alert_image"
}

type ImageStore interface {
	// Get returns the image with the token or ErrImageNotFound.
	GetImage(ctx context.Context, token string) (*Image, error)

	// Saves the image or returns an error.
	SaveImage(ctx context.Context, img *Image) error

	GetURL(ctx context.Context, token string) (string, error)

	GetFilepath(ctx context.Context, token string) (string, error)

	// Returns an io.ReadCloser that reads out the image data for the provided
	// token, if available. May return ErrImageNotFound.
	GetData(ctx context.Context, token string) (io.ReadCloser, error)
}

func (st DBstore) GetImage(ctx context.Context, token string) (*Image, error) {
	var img Image
	if err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("token = ?", token).Get(&img)
		if err != nil {
			return fmt.Errorf("failed to get image: %w", err)
		}
		if !exists {
			return ErrImageNotFound
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return &img, nil
}

func (st DBstore) SaveImage(ctx context.Context, img *Image) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: Is this a good idea? Do we actually want to automatically expire
		// rows? See issue https://github.com/grafana/grafana/issues/49366
		img.ExpiresAt = TimeNow().Add(1 * time.Minute).UTC()
		if img.ID == 0 { // xorm will fill this field on Insert.
			token, err := uuid.NewV4()
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

func (st *DBstore) GetURL(ctx context.Context, token string) (string, error) {
	img, err := st.GetImage(ctx, token)
	if err != nil {
		return "", err
	}
	return img.URL, nil
}

func (st *DBstore) GetFilepath(ctx context.Context, token string) (string, error) {
	img, err := st.GetImage(ctx, token)
	if err != nil {
		return "", err
	}
	return img.Path, nil
}

func (st *DBstore) GetData(ctx context.Context, token string) (io.ReadCloser, error) {
	// TODO: Should we support getting data from image.URL? One could configure
	// the system to upload to S3 while still reading data for notifiers like
	// Slack that take multipart uploads.
	img, err := st.GetImage(ctx, token)
	if err != nil {
		return nil, err
	}

	if len(img.Path) == 0 {
		return nil, ErrImageNotFound
	}

	f, err := os.Open(img.Path)
	if err != nil {
		return nil, err
	}

	return f, nil
}

//nolint:unused
func (st DBstore) DeleteExpiredImages(ctx context.Context) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		n, err := sess.Where("expires_at < ?", TimeNow()).Delete(&Image{})
		if err != nil {
			return fmt.Errorf("failed to delete expired images: %w", err)
		}
		st.Logger.Info("deleted expired images", "n", n)
		return err
	})
}
