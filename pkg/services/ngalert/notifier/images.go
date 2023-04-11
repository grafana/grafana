package notifier

import (
	"context"
	"errors"

	"github.com/grafana/alerting/images"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type imageStore struct {
	store store.ImageStore
}

func newImageStore(store store.ImageStore) images.ImageStore {
	return &imageStore{
		store: store,
	}
}

func (i imageStore) GetImage(ctx context.Context, url string) (*images.Image, error) {
	image, err := i.store.GetImage(ctx, url)
	if err != nil {
		if errors.Is(err, models.ErrImageNotFound) {
			err = images.ErrImageNotFound
		}
	}
	var result *images.Image
	if image != nil {
		result = &images.Image{
			Path:      image.Path,
			URL:       image.URL,
			CreatedAt: image.CreatedAt,
		}
	}
	return result, err
}
