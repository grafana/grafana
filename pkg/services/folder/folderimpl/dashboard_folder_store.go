package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

// DashboardStore implements the FolderStore interface
// It fetches folders from the dashboard DB table
type DashboardFolderStoreImpl struct {
	store        db.DB
	caching      bool
	cacheService *localcache.CacheService
	log          log.Logger
}

func ProvideDashboardFolderStore(sqlStore db.DB, cacheService *localcache.CacheService) *DashboardFolderStoreImpl {
	return &DashboardFolderStoreImpl{store: sqlStore, cacheService: cacheService, caching: true, log: log.New("dashboard.folder")}
}

func (d *DashboardFolderStoreImpl) disableCaching() {
	d.caching = false
}

func (d *DashboardFolderStoreImpl) GetFolderByTitle(ctx context.Context, orgID int64, title string) (*folder.Folder, error) {
	if title == "" {
		return nil, dashboards.ErrFolderTitleEmpty
	}

	cacheKey := get_folder_by_title_cache_key(orgID, title)
	return d.withCaching(cacheKey, func() (*folder.Folder, error) {
		// there is a unique constraint on org_id, folder_id, title
		// there are no nested folders so the parent folder id is always 0
		dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, Title: title}
		err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			has, err := sess.Table(&dashboards.Dashboard{}).Where("is_folder = " + d.store.GetDialect().BooleanStr(true)).Where("folder_id=0").Get(&dashboard)
			if err != nil {
				return err
			}
			if !has {
				return dashboards.ErrFolderNotFound
			}
			dashboard.SetID(dashboard.ID)
			dashboard.SetUID(dashboard.UID)
			return nil
		})
		return dashboards.FromDashboard(&dashboard), err
	})
}

func (d *DashboardFolderStoreImpl) GetFolderByID(ctx context.Context, orgID int64, id int64) (*folder.Folder, error) {
	cacheKey := get_folder_by_id_cache_key(orgID, id)
	return d.withCaching(cacheKey, func() (*folder.Folder, error) {
		dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, ID: id}
		err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			has, err := sess.Table(&dashboards.Dashboard{}).Where("is_folder = " + d.store.GetDialect().BooleanStr(true)).Where("folder_id=0").Get(&dashboard)
			if err != nil {
				return err
			}
			if !has {
				return dashboards.ErrFolderNotFound
			}
			dashboard.SetID(dashboard.ID)
			dashboard.SetUID(dashboard.UID)
			return nil
		})
		if err != nil {
			return nil, err
		}
		return dashboards.FromDashboard(&dashboard), nil
	})
}

func (d *DashboardFolderStoreImpl) GetFolderByUID(ctx context.Context, orgID int64, uid string) (*folder.Folder, error) {
	if uid == "" {
		return nil, dashboards.ErrDashboardIdentifierNotSet
	}

	cacheKey := get_folder_by_uid_cache_key(orgID, uid)
	return d.withCaching(cacheKey, func() (*folder.Folder, error) {
		dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, UID: uid}
		err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			has, err := sess.Table(&dashboards.Dashboard{}).Where("is_folder = " + d.store.GetDialect().BooleanStr(true)).Where("folder_id=0").Get(&dashboard)
			if err != nil {
				return err
			}
			if !has {
				return dashboards.ErrFolderNotFound
			}
			dashboard.SetID(dashboard.ID)
			dashboard.SetUID(dashboard.UID)
			return nil
		})
		if err != nil {
			return nil, err
		}

		res := dashboards.FromDashboard(&dashboard)
		return res, nil
	})
}

func (d *DashboardFolderStoreImpl) withCaching(cacheKey string, f func() (*folder.Folder, error)) (*folder.Folder, error) {
	if !d.caching {
		return f()
	}

	if f, ok := d.cacheService.Get(cacheKey); ok {
		d.log.Debug("cache hit", "key", cacheKey)
		return f.(*folder.Folder), nil
	}

	res, err := f()
	d.log.Debug("cache miss", "key", cacheKey, "err", err)
	if err != nil {
		return nil, err
	}

	d.cacheService.Set(get_folder_by_title_cache_key(res.OrgID, res.Title), res, 0)
	d.cacheService.Set(get_folder_by_uid_cache_key(res.OrgID, res.UID), res, 0)
	d.cacheService.Set(get_folder_by_id_cache_key(res.OrgID, res.ID), res, 0)
	return res, nil
}
