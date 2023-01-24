package querycaching

import "context"

func ProvideService() *OSSDatasourceCacheConfigImpl {
	return &OSSDatasourceCacheConfigImpl{}
}

type OSSDatasourceCacheConfigImpl struct {
}

func (c *OSSDatasourceCacheConfigImpl) GetAllDatasourceConfig(ctx context.Context) (CacheConfigMap, error) {
	return CacheConfigMap{}, nil
}
