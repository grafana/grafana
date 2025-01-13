package blob

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/setting"
)

type localBlobStore struct {
	enabled bool
	url     string
	dir     string
	ext     []string
}

func newLocalBlobStore(cfg *setting.Cfg) *localBlobStore {
	if false {
		return &localBlobStore{enabled: false}
	}

	return &localBlobStore{
		enabled: true,
		dir:     filepath.Join(cfg.DataPath, "blob"),
		url:     cfg.AppURL + "static/blob/", // the public URL
		ext:     []string{".png", ".pdf"},
	}
}

var (
	_ PublicBlobStore = (*localBlobStore)(nil)
)

// IsAvailable implements PublicBlobStore.
func (s *localBlobStore) IsAvailable() bool {
	return s.enabled
}

// SaveBlob implements PublicBlobStore.
func (s *localBlobStore) SaveBlob(ctx context.Context, namespace string, ext string, data []byte, meta map[string]string) (string, error) {
	if !s.enabled {
		return "", fmt.Errorf("not enabled")
	}
	if !slices.Contains(s.ext, ext) {
		return "", fmt.Errorf("unsupported extension")
	}
	if namespace == "" { // TODO... more!!!
		return "", fmt.Errorf("invalid namespace")
	}

	name := uuid.NewString() + ext
	dirname := time.Now().UTC().Format(time.DateOnly)
	err := os.MkdirAll(filepath.Join(s.dir, namespace, dirname), 0700)
	if err != nil {
		return "", err
	}

	err = os.WriteFile(filepath.Join(s.dir, namespace, dirname, name), data, 0600)
	if err != nil {
		return "", err
	}

	return s.url + namespace + "/" + dirname + "/" + name, nil
}
