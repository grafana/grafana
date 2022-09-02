package storage

import (
	"archive/zip"
	"context"
)

type Manager interface {
	Add(ctx context.Context, pluginID string, rc *zip.ReadCloser) (*ExtractedPluginArchive, error)
	Remove(ctx context.Context, pluginID string) error
}
