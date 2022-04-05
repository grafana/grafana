package datasources

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeCacheService struct {
	DataSources []*models.DataSource
}

var _ CacheService = &FakeCacheService{}

func (c *FakeCacheService) GetDatasource(ctx context.Context, datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error) {
	for _, datasource := range c.DataSources {
		if datasource.Id == datasourceID {
			return datasource, nil
		}
	}
	return nil, models.ErrDataSourceNotFound
}

func (c *FakeCacheService) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *models.SignedInUser, skipCache bool) (*models.DataSource, error) {
	for _, datasource := range c.DataSources {
		if datasource.Uid == datasourceUID {
			return datasource, nil
		}
	}
	return nil, models.ErrDataSourceNotFound
}
