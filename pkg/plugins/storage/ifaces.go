package storage

import (
	"archive/zip"
	"context"
)

type ZipExtractor interface {
	Extract(ctx context.Context, pluginID string, rc *zip.ReadCloser) (*ExtractedPluginArchive, error)
}
