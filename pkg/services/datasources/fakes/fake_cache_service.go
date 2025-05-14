package datasources

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type FakeCacheService struct {
	DataSources []*datasources.DataSource
}

var _ datasources.CacheService = &FakeCacheService{}

func (c *FakeCacheService) GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester, skipCache bool) (*datasources.DataSource, error) {
	for _, datasource := range c.DataSources {
		if datasource.ID == datasourceID {
			return datasource, nil
		}
	}
	return nil, datasources.ErrDataSourceNotFound
}

func (c *FakeCacheService) GetDatasourceByUID(ctx context.Context, datasourceUID string, user identity.Requester, skipCache bool) (*datasources.DataSource, error) {
	for _, datasource := range c.DataSources {
		if datasource.UID == datasourceUID {
			return datasource, nil
		}
	}
	return nil, datasources.ErrDataSourceNotFound
}
