package database

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

// Define the storage implementation. We're generating the mock implementation
// automatically
type PublicDashboardStoreImpl struct {
	sqlStore *sqlstore.SQLStore
	log      log.Logger
	dialect  migrator.Dialect
}

var LogPrefix = "publicdashboards.store"

// Gives us a compile time error if our database does not adhere to contract of
// the interface
var _ publicdashboards.Store = (*PublicDashboardStoreImpl)(nil)

// Factory used by wire to dependency injection
func ProvideStore(sqlStore *sqlstore.SQLStore) *PublicDashboardStoreImpl {
	return &PublicDashboardStoreImpl{
		sqlStore: sqlStore,
		log:      log.New(LogPrefix),
		dialect:  sqlStore.Dialect,
	}
}

func (d *PublicDashboardStoreImpl) GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error) {
	dashboard := &models.Dashboard{Uid: dashboardUid}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(dashboard)
		if err != nil {
			return err
		}
		if !has {
			return ErrPublicDashboardNotFound
		}
		return nil
	})

	return dashboard, err
}

// Retrieves public dashboard configuration
func (d *PublicDashboardStoreImpl) GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error) {
	if accessToken == "" {
		return nil, nil, ErrPublicDashboardIdentifierNotSet
	}

	// get public dashboard
	pdRes := &PublicDashboard{AccessToken: accessToken}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(pdRes)
		if err != nil {
			return err
		}
		if !has {
			return ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	// find dashboard
	dashRes, err := d.GetDashboard(ctx, pdRes.DashboardUid)

	if err != nil {
		return nil, nil, err
	}

	return pdRes, dashRes, err
}

// Generates a new unique uid to retrieve a public dashboard
func (d *PublicDashboardStoreImpl) GenerateNewPublicDashboardUid(ctx context.Context) (string, error) {
	var uid string

	err := d.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for i := 0; i < 3; i++ {
			uid = util.GenerateShortUID()

			exists, err := sess.Get(&PublicDashboard{Uid: uid})
			if err != nil {
				return err
			}

			if !exists {
				return nil
			}
		}

		return ErrPublicDashboardFailedGenerateUniqueUid
	})

	if err != nil {
		return "", err
	}

	return uid, nil
}

// Retrieves public dashboard configuration by Uid
func (d *PublicDashboardStoreImpl) GetPublicDashboardByUid(ctx context.Context, uid string) (*PublicDashboard, error) {
	if uid == "" {
		return nil, nil
	}

	var found bool
	pdRes := &PublicDashboard{Uid: uid}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		found, err = sess.Get(pdRes)
		return err
	})

	if err != nil {
		return nil, err
	}

	if !found {
		return nil, nil
	}

	return pdRes, err
}

// Retrieves public dashboard configuration
func (d *PublicDashboardStoreImpl) GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	if dashboardUid == "" {
		return nil, dashboards.ErrDashboardIdentifierNotSet
	}

	pdRes := &PublicDashboard{OrgId: orgId, DashboardUid: dashboardUid}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// publicDashboard
		_, err := sess.Get(pdRes)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return pdRes, err
}

// Persists public dashboard configuration
func (d *PublicDashboardStoreImpl) SavePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error {
	if cmd.PublicDashboard.DashboardUid == "" {
		return dashboards.ErrDashboardIdentifierNotSet
	}

	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.UseBool("is_enabled").Insert(&cmd.PublicDashboard)
		if err != nil {
			return err
		}

		return nil
	})

	return err
}

// updates existing public dashboard configuration
func (d *PublicDashboardStoreImpl) UpdatePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error {
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		timeSettingsJSON, err := json.Marshal(cmd.PublicDashboard.TimeSettings)
		if err != nil {
			return err
		}

		_, err = sess.Exec("UPDATE dashboard_public SET is_enabled = ?, time_settings = ?, updated_by = ?, updated_at = ? WHERE uid = ?",
			cmd.PublicDashboard.IsEnabled,
			string(timeSettingsJSON),
			cmd.PublicDashboard.UpdatedBy,
			cmd.PublicDashboard.UpdatedAt.UTC().Format("2006-01-02 15:04:05"),
			cmd.PublicDashboard.Uid)

		if err != nil {
			return err
		}

		return nil
	})

	return err
}

func (d *PublicDashboardStoreImpl) PublicDashboardEnabled(ctx context.Context, dashboardUid string) (bool, error) {
	hasPublicDashboard := false
	err := d.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sql := "SELECT COUNT(*) FROM dashboard_public WHERE dashboard_uid=? AND is_enabled=true"

		result, err := dbSession.SQL(sql, dashboardUid).Count()
		if err != nil {
			return err
		}

		hasPublicDashboard = result > 0

		return err
	})

	return hasPublicDashboard, err
}

func (d *PublicDashboardStoreImpl) AccessTokenExists(ctx context.Context, accessToken string) (bool, error) {
	hasPublicDashboard := false
	err := d.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sql := "SELECT COUNT(*) FROM dashboard_public WHERE access_token=? AND is_enabled=true"

		result, err := dbSession.SQL(sql, accessToken).Count()
		if err != nil {
			return err
		}

		hasPublicDashboard = result > 0

		return err
	})

	return hasPublicDashboard, err
}
