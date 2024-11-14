package sources

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Registry interface {
	List(context.Context) []plugins.PluginSource
}
