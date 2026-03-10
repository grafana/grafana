package store

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ErrNoDatasourceSync is returned when no datasource sync configuration exists for an org.
var ErrNoDatasourceSync = errors.New("no datasource sync configuration found")

// DatasourceSyncStore manages the datasource sync configuration in the database.
type DatasourceSyncStore interface {
	GetAllDatasourceSyncs(ctx context.Context) ([]*ngmodels.DatasourceSync, error)
	GetDatasourceSync(ctx context.Context, orgID int64) (*ngmodels.DatasourceSync, error)
	UpsertDatasourceSync(ctx context.Context, sync *ngmodels.DatasourceSync) error
	UpdateDatasourceSyncStatus(ctx context.Context, orgID int64, lastSyncAt time.Time, lastError string) error
}

// GetAllDatasourceSyncs returns all datasource sync configurations across all orgs.
func (st DBstore) GetAllDatasourceSyncs(ctx context.Context) ([]*ngmodels.DatasourceSync, error) {
	var result []*ngmodels.DatasourceSync
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table("ngalert_datasource_sync").Find(&result)
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetDatasourceSync returns the datasource sync configuration for a specific org.
func (st DBstore) GetDatasourceSync(ctx context.Context, orgID int64) (*ngmodels.DatasourceSync, error) {
	result := &ngmodels.DatasourceSync{}
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table("ngalert_datasource_sync").Where("org_id = ?", orgID).Get(result)
		if err != nil {
			return err
		}
		if !has {
			return ErrNoDatasourceSync
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// UpsertDatasourceSync inserts or updates a datasource sync configuration.
func (st DBstore) UpsertDatasourceSync(ctx context.Context, sync *ngmodels.DatasourceSync) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table("ngalert_datasource_sync").Where("org_id = ?", sync.OrgID).Exist()
		if err != nil {
			return err
		}
		if !has {
			_, err := sess.Table("ngalert_datasource_sync").Insert(sync)
			return err
		}
		_, err = sess.Table("ngalert_datasource_sync").Where("org_id = ?", sync.OrgID).AllCols().Update(sync)
		return err
	})
}

// UpdateDatasourceSyncStatus updates the last sync time and error for a datasource sync.
func (st DBstore) UpdateDatasourceSyncStatus(ctx context.Context, orgID int64, lastSyncAt time.Time, lastError string) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table("ngalert_datasource_sync").
			Where("org_id = ?", orgID).
			Cols("last_sync_at", "last_error").
			Update(&ngmodels.DatasourceSync{LastSyncAt: lastSyncAt, LastError: lastError})
		return err
	})
}
