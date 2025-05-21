package notifier

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"

	alertingImages "github.com/grafana/alerting/images"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type tokenStore struct {
	store  store.ImageStore
	logger log.Logger
}

var _ alertingImages.TokenStore = (*tokenStore)(nil)

func newImageProvider(store store.ImageStore, logger log.Logger) alertingImages.Provider {
	return alertingImages.NewTokenProvider(&tokenStore{
		store:  store,
		logger: logger,
	}, logger)
}

func (t tokenStore) GetImage(ctx context.Context, token string) (*alertingImages.Image, error) {
	image, err := t.store.GetImage(ctx, token)
	if err != nil {
		if errors.Is(err, models.ErrImageNotFound) {
			return nil, alertingImages.ErrImageNotFound
		}
		return nil, err
	}

	return &alertingImages.Image{
		ID:  token,
		URL: image.URL,
		RawData: func(_ context.Context) (alertingImages.ImageContent, error) {
			if image.Path == "" {
				return alertingImages.ImageContent{}, models.ErrImageDataUnavailable
			}
			b, err := readImage(image.Path, t.logger)
			if err != nil {
				return alertingImages.ImageContent{}, err
			}
			return alertingImages.ImageContent{
				Name:    filepath.Base(image.Path),
				Content: b,
			}, nil
		},
	}, nil
}

// readImage returns an image from the given path.
func readImage(path string, logger log.Logger) ([]byte, error) {
	fp := filepath.Clean(path)
	_, err := os.Stat(fp)
	if os.IsNotExist(err) || os.IsPermission(err) {
		return nil, models.ErrImageNotFound
	}

	f, err := os.Open(fp)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := f.Close(); err != nil {
			logger.Error("Failed to close image file", "error", err)
		}
	}()

	return io.ReadAll(f)
}
