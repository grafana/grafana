package datasources

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type CacheService interface {
	GetDatasource(datasourceID int64, orgId int64, skipCache bool) (*models.DataSource, error)
}

type CacheServiceImpl struct {
	CacheService *localcache.CacheService `inject:""`
	SQLStore     *sqlstore.SQLStore       `inject:""`
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "DatasourceCacheService",
		Instance:     &CacheServiceImpl{},
		InitPriority: registry.Low,
	})
}

func (dc *CacheServiceImpl) Init() error {
	return nil
}

func (dc *CacheServiceImpl) GetDatasource(
	datasourceID int64,
	orgID int64,
	skipCache bool,
) (*models.DataSource, error) {
	cacheKey := fmt.Sprintf("ds-%d", datasourceID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(cacheKey); found {
			ds := cached.(*models.DataSource)
			if ds.OrgId == orgID {
				return ds, nil
			}
		}
	}

	plog.Debug("Querying for data source via SQL store", "id", datasourceID, "orgId", orgID)
	ds, err := dc.SQLStore.GetDataSourceByID(datasourceID, orgID)
	if err != nil {
		return nil, err
	}

	dc.CacheService.Set(cacheKey, ds, time.Second*5)
	return ds, nil
}
