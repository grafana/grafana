package storage

import (
	"archive/zip"
	"context"
)

type ZipExtractor interface {
	Extract(ctx context.Context, pluginID string, destDir DirNameGeneratorFunc, rc *zip.ReadCloser) (*ExtractedPluginArchive, error)
}

type DirNameGeneratorFunc = func(pluginID string) string
