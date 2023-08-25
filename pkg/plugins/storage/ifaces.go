package storage

import (
	"archive/zip"
	"context"
)

type Extractor interface {
	Extract(ctx context.Context, pluginID string, destDir NamerFunc, rc *zip.ReadCloser) (*ExtractedPluginArchive, error)
}

type NamerFunc = func(pluginID string) string
