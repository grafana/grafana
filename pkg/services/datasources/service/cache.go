package service

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

const (
	DefaultCacheTTL = 5 * time.Second
)

func ProvideCacheService(cacheService *localcache.CacheService, dbProvider legacysql.LegacyDatabaseProvider, dsGuardian guardian.DatasourceGuardianProvider) *CacheServiceImpl {
	return &CacheServiceImpl{
		logger:       log.New("datasources"),
		cacheTTL:     DefaultCacheTTL,
		CacheService: cacheService,
		dbProvider:   dbProvider,
		dsGuardian:   dsGuardian,
	}
}

type CacheServiceImpl struct {
	logger       log.Logger
	cacheTTL     time.Duration
	CacheService *localcache.CacheService
	dbProvider   legacysql.LegacyDatabaseProvider
	dsGuardian   guardian.DatasourceGuardianProvider
}

func (dc *CacheServiceImpl) GetDatasource(
	ctx context.Context,
	datasourceID int64,
	user identity.Requester,
	skipCache bool,
) (*datasources.DataSource, error) {
	cacheKey := idKey(ctx, datasourceID)

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

	query := &datasources.GetDataSourceQuery{ID: datasourceID, OrgID: user.GetOrgID()} //nolint:staticcheck // Preserve legacy field compatibility.
	ss := SqlStore{logger: dc.logger, dbProvider: dc.dbProvider}
	ds, err := ss.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	if ds.UID != "" {
		dc.CacheService.Set(uidKey(ctx, ds.OrgID, ds.UID), ds, time.Second*5)
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
	uidCacheKey := uidKey(ctx, user.GetOrgID(), datasourceUID)

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
	ss := SqlStore{logger: dc.logger, dbProvider: dc.dbProvider}
	ds, err := ss.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	dc.CacheService.Set(uidCacheKey, ds, dc.cacheTTL)
	dc.CacheService.Set(idKey(ctx, ds.ID), ds, dc.cacheTTL)

	if err = dc.canQuery(user, ds); err != nil {
		return nil, err
	}

	return ds, nil
}

// Cache keys are scoped by the tenant namespace because the dbProvider can resolve each
// tenant to its own tables, where IDs and UIDs are not unique across tenants.
func idKey(ctx context.Context, id int64) string {
	return fmt.Sprintf("ds-%s/%d", request.NamespaceValue(ctx), id)
}

func uidKey(ctx context.Context, orgID int64, uid string) string {
	return fmt.Sprintf("ds-orgid-uid-%s/%d-%s", request.NamespaceValue(ctx), orgID, uid)
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
