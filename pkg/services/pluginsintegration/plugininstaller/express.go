package plugininstaller

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Express interface {
	Plugins(ctx context.Context) []string
	Source(ctx context.Context, pluginID, pluginVersion string) (plugins.PluginSource, bool)
}

type ExpressService struct{}

func ProvideExpressService() *ExpressService {
	return &ExpressService{}
}

func (es *ExpressService) Plugins(_ context.Context) []string {
	return []string{}
}

func (es *ExpressService) Source(_ context.Context, _, _ string) (plugins.PluginSource, bool) {
	return nil, false
}
