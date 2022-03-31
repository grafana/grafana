package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// Service is responsible for loading plugins from the file system.
type Service interface {
	// Load will return a list of plugins found in the provided file system paths.
	Load(ctx context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error)
}
