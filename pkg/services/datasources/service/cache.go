package service

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
)

const (
	DefaultCacheTTL = 5 * time.Second
)

func ProvideCacheService(cacheService *localcache.CacheService, sqlStore db.DB, dsGuardian guardian.DatasourceGuardianProvider) *CacheServiceImpl {
	return &CacheServiceImpl{
		logger:       log.New("datasources"),
		cacheTTL:     DefaultCacheTTL,
		CacheService: cacheService,
		SQLStore:     sqlStore,
		dsGuardian:   dsGuardian,
	}
}

type CacheServiceImpl struct {
	logger       log.Logger
	cacheTTL     time.Duration
	CacheService *localcache.CacheService
	SQLStore     db.DB
	dsGuardian   guardian.DatasourceGuardianProvider
}

func (dc *CacheServiceImpl) GetDatasource(
	ctx context.Context,
	datasourceID int64,
	user identity.Requester,
	skipCache bool,
) (*datasources.DataSource, error) {
	cacheKey := idKey(datasourceID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(cacheKey); found {
			ds := cached.(*datasources.DataSource)
			if ds.OrgID == user.GetOrgID() {
				if err := dc.canQuery(user, ds); err != nil {
					return nil, err
				}
				return ds, nil
			}
		}
	}

	dc.logger.FromContext(ctx).Debug("Querying for data source via SQL store", "id", datasourceID, "orgId", user.GetOrgID())

	query := &datasources.GetDataSourceQuery{ID: datasourceID, OrgID: user.GetOrgID()}
	ss := SqlStore{db: dc.SQLStore, logger: dc.logger}
	ds, err := ss.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	if ds.UID != "" {
		dc.CacheService.Set(uidKey(ds.OrgID, ds.UID), ds, time.Second*5)
	}
	dc.CacheService.Set(cacheKey, ds, dc.cacheTTL)

	if err = dc.canQuery(user, ds); err != nil {
		return nil, err
	}

	return ds, nil
}

func (dc *CacheServiceImpl) GetDatasourceByUID(
	ctx context.Context,
	datasourceUID string,
	user identity.Requester,
	skipCache bool,
) (*datasources.DataSource, error) {
	if datasourceUID == "" {
		return nil, fmt.Errorf("can not get data source by uid, uid is empty")
	}
	if user.GetOrgID() == 0 {
		return nil, fmt.Errorf("can not get data source by uid, orgId is missing")
	}
	uidCacheKey := uidKey(user.GetOrgID(), datasourceUID)

	if !skipCache {
		if cached, found := dc.CacheService.Get(uidCacheKey); found {
			ds := cached.(*datasources.DataSource)
			if ds.OrgID == user.GetOrgID() {
				if err := dc.canQuery(user, ds); err != nil {
					return nil, err
				}
				return ds, nil
			}
		}
	}

	dc.logger.FromContext(ctx).Debug("Querying for data source via SQL store", "uid", datasourceUID, "orgId", user.GetOrgID())
	query := &datasources.GetDataSourceQuery{UID: datasourceUID, OrgID: user.GetOrgID()}
	ss := SqlStore{db: dc.SQLStore, logger: dc.logger}
	ds, err := ss.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	dc.CacheService.Set(uidCacheKey, ds, dc.cacheTTL)
	dc.CacheService.Set(idKey(ds.ID), ds, dc.cacheTTL)

	if err = dc.canQuery(user, ds); err != nil {
		return nil, err
	}

	return ds, nil
}

func idKey(id int64) string {
	return fmt.Sprintf("ds-%d", id)
}

func uidKey(orgID int64, uid string) string {
	return fmt.Sprintf("ds-orgid-uid-%d-%s", orgID, uid)
}

func (dc *CacheServiceImpl) canQuery(user identity.Requester, ds *datasources.DataSource) error {
	guardian := dc.dsGuardian.New(user.GetOrgID(), user, *ds)
	if canQuery, err := guardian.CanQuery(ds.ID); err != nil || !canQuery {
		if err != nil {
			return err
		}
		return datasources.ErrDataSourceAccessDenied
	}
	return nil
}
