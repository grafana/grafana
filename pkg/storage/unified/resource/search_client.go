package resource

import (
	"context"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
)

func NewSearchClient(cfg *setting.Cfg, unifiedStorageConfigKey string, unifiedClient func(context.Context) ResourceClient, legacyClient ResourceIndexClient) func(context.Context) ResourceIndexClient {
	config, ok := cfg.UnifiedStorage[unifiedStorageConfigKey]
	if !ok {
		return func(ctx context.Context) ResourceIndexClient { return legacyClient }
	}

	switch config.DualWriterMode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return func(ctx context.Context) ResourceIndexClient { return legacyClient }
	default:
		return func(ctx context.Context) ResourceIndexClient { return unifiedClient(ctx) }
	}
}
