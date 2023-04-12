package notifier

import (
	"context"
	"strings"

	"github.com/grafana/alerting/images"

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

// GetImage retrieves an image from the database and checks its URL.
// If the URL is not a public one, it replaces it with an empty string so that notifiers use the Path field instead.
func (i *imageStore) GetImage(ctx context.Context, url string) (*images.Image, error) {
	image, err := i.store.GetImage(ctx, url)
	if err != nil {
		return nil, err
	}

	if strings.HasPrefix(image.URL, "file://") {
		image.URL = ""
	}

	return &images.Image{
		Path:      image.Path,
		URL:       image.URL,
		CreatedAt: image.CreatedAt,
	}, nil
}
