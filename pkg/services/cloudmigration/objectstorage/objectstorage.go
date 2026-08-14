package objectstorage

import (
	"context"
	"io"
)

type ObjectStorage interface {
	PresignedURLUpload(ctx context.Context, url, key string, reader io.Reader) error
}
