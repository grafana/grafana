package service

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	DefaultCacheTTL = 5 * time.Second
)

func ProvideCacheService(cacheService *localcache.CacheService, sqlStore db.DB) *CacheServiceImpl {
	return &CacheServiceImpl{
		logger:       log.New("datasources"),
		cacheTTL:     DefaultCacheTTL,
		CacheService: cacheService,
		SQLStore:     sqlStore,
	}
}

type CacheServiceImpl struct {
	logger       log.Logger
	cacheTTL     time.Duration
	CacheService *localcache.CacheService
	SQLStore     db.DB
}

func (dc *CacheServiceImpl) GetDatasource(
	ctx context.Context,
	datasourceID int64,
	user *user.SignedInUser,
	skipCache bool,
) (*datasources.DataSource, error) {
	cacheKey := idKey(datasourceID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(cacheKey); found {
			ds := cached.(*datasources.DataSource)
			if ds.OrgID == user.OrgID {
				return ds, nil
			}
		}
	}

	dc.logger.FromContext(ctx).Debug("Querying for data source via SQL store", "id", datasourceID, "orgId", user.OrgID)

	query := &datasources.GetDataSourceQuery{ID: datasourceID, OrgID: user.OrgID}
	ss := SqlStore{db: dc.SQLStore, logger: dc.logger}
	ds, err := ss.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	if ds.UID != "" {
		dc.CacheService.Set(uidKey(ds.OrgID, ds.UID), ds, time.Second*5)
	}
	dc.CacheService.Set(cacheKey, ds, dc.cacheTTL)
	return ds, nil
}

func (dc *CacheServiceImpl) GetDatasourceByUID(
	ctx context.Context,
	datasourceUID string,
	user *user.SignedInUser,
	skipCache bool,
) (*datasources.DataSource, error) {
	if datasourceUID == "" {
		return nil, fmt.Errorf("can not get data source by uid, uid is empty")
	}
	if user.OrgID == 0 {
		return nil, fmt.Errorf("can not get data source by uid, orgId is missing")
	}
	uidCacheKey := uidKey(user.OrgID, datasourceUID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(uidCacheKey); found {
			ds := cached.(*datasources.DataSource)
			if ds.OrgID == user.OrgID {
				return ds, nil
			}
		}
	}

	dc.logger.FromContext(ctx).Debug("Querying for data source via SQL store", "uid", datasourceUID, "orgId", user.OrgID)
	query := &datasources.GetDataSourceQuery{UID: datasourceUID, OrgID: user.OrgID}
	ss := SqlStore{db: dc.SQLStore, logger: dc.logger}
	ds, err := ss.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	dc.CacheService.Set(uidCacheKey, ds, dc.cacheTTL)
	dc.CacheService.Set(idKey(ds.ID), ds, dc.cacheTTL)
	return ds, nil
}

func idKey(id int64) string {
	return fmt.Sprintf("ds-%d", id)
}

func uidKey(orgID int64, uid string) string {
	return fmt.Sprintf("ds-orgid-uid-%d-%s", orgID, uid)
}
