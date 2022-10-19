package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

// Service is responsible for loading plugins from the file system.
type Service interface {
	// LoadFS will return a list of plugins found in the provided fs tree.
	LoadFS(ctx context.Context, class plugins.Class, fs *pfs.Tree) error
	// Load will return a list of plugins found in the provided file system paths.
	Load(ctx context.Context, class plugins.Class, paths []string) ([]*plugins.Plugin, error)
	// Unload will unload a specified plugin from the file system.
	Unload(ctx context.Context, pluginID string) error
}
