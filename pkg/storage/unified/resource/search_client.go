package resource

import (
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
)

func NewSearchClient(cfg *setting.Cfg, unifiedStorageConfigKey string, unifiedClient ResourceIndexClient, legacyClient ResourceIndexClient) ResourceIndexClient {
	config, ok := cfg.UnifiedStorage[unifiedStorageConfigKey]
	if !ok {
		return legacyClient
	}

	switch config.DualWriterMode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return legacyClient
	default:
		return unifiedClient
	}
}
