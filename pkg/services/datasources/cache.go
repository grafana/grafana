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
	GetDatasource(datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)
}

type CacheServiceImpl struct {
	CacheService *localcache.CacheService `inject:""`
	SQLStore     *sqlstore.SqlStore       `inject:""`
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
	user *models.SignedInUser,
	skipCache bool,
) (*models.DataSource, error) {
	cacheKey := fmt.Sprintf("ds-%d", datasourceID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(cacheKey); found {
			ds := cached.(*models.DataSource)
			if ds.OrgId == user.OrgId {
				return ds, nil
			}
		}
	}

	plog.Debug("Querying for data source via SQL store", "id", datasourceID, "orgId", user.OrgId)
	ds, err := dc.SQLStore.GetDataSourceByID(datasourceID, user.OrgId)
	if err != nil {
		return nil, err
	}

	dc.CacheService.Set(cacheKey, ds, time.Second*5)
	return ds, nil
}
