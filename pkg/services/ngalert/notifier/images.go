package notifier

import (
	"context"
	"strings"

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

func (i imageStore) GetImage(ctx context.Context, uri string) (*images.Image, error) {
	var image *models.Image
	var err error

	// Check whether the uri is a token or a URL to know how to query the DB.
	token := strings.TrimPrefix(uri, "token://")
	if len(token) < len(uri) {
		// If the final string is shorter, it means that it was prefixed.
		if image, err = i.store.GetImage(ctx, token); err != nil {
			return nil, err
		}
	} else {
		if image, err = i.store.GetImageByURL(ctx, uri); err != nil {
			return nil, err
		}
	}

	return &images.Image{
		Token:     image.Token,
		Path:      image.Path,
		URL:       image.URL,
		CreatedAt: image.CreatedAt,
	}, nil
}
