package datasources

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type CacheService interface {
	GetDatasource(datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)
	SetSQLStore(sqlStore *sqlstore.SqlStore)
}

type CacheServiceImpl struct {
	Bus          bus.Bus                  `inject:""`
	CacheService *localcache.CacheService `inject:""`
	sqlStore     *sqlstore.SqlStore
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

func (dc *CacheServiceImpl) GetDatasource(datasourceID int64, user *models.SignedInUser, skipCache bool) (
	*models.DataSource, error) {
	cacheKey := fmt.Sprintf("ds-%d", datasourceID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(cacheKey); found {
			ds := cached.(*models.DataSource)
			if ds.OrgId == user.OrgId {
				return ds, nil
			}
		}
	}

	var ds *models.DataSource
	if dc.sqlStore == nil {
		// Legacy way, should migrate away from this
		plog.Debug("Querying for data source via bus", "id", datasourceID, "orgId", user.OrgId)
		query := models.GetDataSourceByIdQuery{Id: datasourceID, OrgId: user.OrgId}
		if err := dc.Bus.Dispatch(&query); err != nil {
			return nil, err
		}
		ds = query.Result
	} else {
		plog.Debug("Querying for data source via SQL store", "id", datasourceID, "orgId", user.OrgId)
		var err error
		ds, err = dc.sqlStore.GetDataSourceByID(datasourceID, user.OrgId)
		if err != nil {
			return nil, err
		}
	}

	dc.CacheService.Set(cacheKey, ds, time.Second*5)
	return ds, nil
}

func (dc *CacheServiceImpl) SetSQLStore(sqlStore *sqlstore.SqlStore) {
	dc.sqlStore = sqlStore
}
