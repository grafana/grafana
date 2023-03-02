package sources

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Resolver interface {
	List(context.Context) []plugins.PluginSource
}
