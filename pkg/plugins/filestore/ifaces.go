package filestore

import (
	"archive/zip"
	"context"
)

type Manager interface {
	Add(ctx context.Context, rc *zip.ReadCloser, pluginID, pluginsPath string) (*ExtractedPluginArchive, error)
	Remove(ctx context.Context, pluginDir string) error
}
