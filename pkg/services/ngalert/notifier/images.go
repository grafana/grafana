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
	var (
		image *models.Image
		err   error
	)

	// Check whether the uri is a URL or a token to know how to query the DB.
	if strings.HasPrefix(uri, "http") {
		image, err = i.store.GetImageByURL(ctx, uri)
	} else {
		token := strings.TrimPrefix(uri, "token://")
		image, err = i.store.GetImage(ctx, token)
	}
	if err != nil {
		return nil, err
	}

	return &images.Image{
		Token:     image.Token,
		Path:      image.Path,
		URL:       image.URL,
		CreatedAt: image.CreatedAt,
	}, nil
}
