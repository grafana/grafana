package plugininstaller

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Express interface {
	Plugins(ctx context.Context) []string
	Source(ctx context.Context, pluginID, pluginVersion string) (plugins.PluginSource, bool)
}

type NoopExpressService struct{}

func ProvideNoopExpressService() *NoopExpressService {
	return &NoopExpressService{}
}

func (es *NoopExpressService) Plugins(_ context.Context) []string {
	return []string{}
}

func (es *NoopExpressService) Source(_ context.Context, _, _ string) (plugins.PluginSource, bool) {
	return nil, false
}
