package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// retrieves public dashboard configuration
func (d *DashboardStore) GetPublicDashboard(ctx context.Context, accessToken string) (*models.PublicDashboard, *models.Dashboard, error) {
	if accessToken == "" {
		return nil, nil, dashboards.ErrPublicDashboardIdentifierNotSet
	}

	// get public dashboard
	pdRes := &models.PublicDashboard{AccessToken: accessToken}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(pdRes)
		if err != nil {
			return err
		}
		if !has {
			return dashboards.ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	// find dashboard
	dashRes := &models.Dashboard{OrgId: pdRes.OrgId, Uid: pdRes.DashboardUid}
	err = d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(dashRes)
		if err != nil {
			return err
		}
		if !has {
			return dashboards.ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	return pdRes, dashRes, err
}

// generates a new unique uid to retrieve a public dashboard
func (d *DashboardStore) GenerateNewPublicDashboardUid(ctx context.Context) (string, error) {
	var uid string

	err := d.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for i := 0; i < 3; i++ {
			uid = util.GenerateShortUID()

			exists, err := sess.Get(&models.PublicDashboard{Uid: uid})
			if err != nil {
				return err
			}

			if !exists {
				return nil
			}
		}

		return dashboards.ErrPublicDashboardFailedGenerateUniqueUid
	})

	if err != nil {
		return "", err
	}

	return uid, nil
}

// retrieves public dashboard configuration
func (d *DashboardStore) GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*models.PublicDashboard, error) {
	if dashboardUid == "" {
		return nil, dashboards.ErrDashboardIdentifierNotSet
	}

	pdRes := &models.PublicDashboard{OrgId: orgId, DashboardUid: dashboardUid}
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

// persists public dashboard configuration
func (d *DashboardStore) SavePublicDashboardConfig(ctx context.Context, cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboard, error) {
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.UseBool("is_enabled").Insert(&cmd.PublicDashboard)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &cmd.PublicDashboard, nil
}

// updates existing public dashboard configuration
func (d *DashboardStore) UpdatePublicDashboardConfig(ctx context.Context, cmd models.SavePublicDashboardConfigCommand) error {
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		timeSettingsJSON, err := cmd.PublicDashboard.TimeSettings.MarshalJSON()
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
