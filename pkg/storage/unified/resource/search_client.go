package resource

import (
	"github.com/grafana/grafana/pkg/setting"
)

// Search Fallback was returning both Folders and Dashboards which resulted
// in issues with rendering the Folder UI. Also, filters are not implemented
// yet. For those reasons, we will be disabling Search Fallback for now
func NewSearchClient(cfg *setting.Cfg, unifiedStorageConfigKey string, unifiedClient ResourceIndexClient, legacyClient ResourceIndexClient) ResourceIndexClient {
	// config, ok := cfg.UnifiedStorage[unifiedStorageConfigKey]
	// if !ok {
	// 	return legacyClient
	// }

	// switch config.DualWriterMode {
	// case rest.Mode0, rest.Mode1, rest.Mode2:
	// 	return legacyClient
	// default:
	// 	return unifiedClient
	// }

	return unifiedClient
}
