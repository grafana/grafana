package blob

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type PublicBlobStore interface {
	IsAvailable() bool

	// The result is an fully qualified URL that will serve the files
	SaveBlob(ctx context.Context, namespace string, ext string, body []byte, meta map[string]string) (string, error)
}

// TODO? can we register the static route directly, rather than hacked into api.go
func ProvidePublicBlobStore(cfg *setting.Cfg) (PublicBlobStore, error) {
	return newLocalBlobStore(cfg), nil
}
