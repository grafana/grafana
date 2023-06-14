package finder

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Finder interface {
	Find(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
}
