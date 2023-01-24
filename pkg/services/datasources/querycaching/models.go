package querycaching

import "context"

type DatasourceCacheConfig interface {
	GetAllDatasourceConfig(ctx context.Context) (CacheConfigMap, error)
}

// Map of datasource UIDs to cache configs
type CacheConfigMap map[string]CacheConfig

type CacheConfig struct {
	Enabled       bool  `json:"enabled"`
	TTLMS         int64 `json:"ttl_ms"`
	UseDefaultTTL bool  `json:"default_ttl"`
}
