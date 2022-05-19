package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func generateNewPublicDashboardUid(sess *sqlstore.DBSession) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("uid=?", uid).Get(&models.PublicDashboard{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrPublicDashboardFailedGenerateUniqueUid
}

// retrieves public dashboard configuration
func (d *DashboardStore) GetPublicDashboardConfig(orgId int64, dashboardUid string) (*models.PublicDashboardConfig, error) {
	// get global dashboard config
	var dashRes []*models.Dashboard

	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Where("org_id = ? AND uid= ?", orgId, dashboardUid).Find(&dashRes)
	})

	if len(dashRes) == 0 {
		return nil, models.ErrDashboardNotFound
	}

	pdc := &models.PublicDashboardConfig{
		IsPublic: dashRes[0].IsPublic,
	}

	// get public dashboards
	var pdRes []*models.PublicDashboard
	err = d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Where("org_id = ? AND dashboard_uid= ?", orgId, dashboardUid).Find(&pdRes)
	})

	if len(pdRes) > 0 {
		pdc.PublicDashboard = *pdRes[0]
	}

	return pdc, err
}

// stores public dashboard configuration
func (d *DashboardStore) SavePublicDashboardConfig(cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboardConfig, error) {
	// update isPublic on dashboard entry
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		affectedRowCount, err := sess.Table("dashboard").Where("org_id = ? AND uid = ?", cmd.OrgId, cmd.DashboardUid).Update(map[string]interface{}{"is_public": cmd.PublicDashboardConfig.IsPublic})
		if err != nil {
			return err
		}

		if affectedRowCount == 0 {
			return models.ErrDashboardNotFound
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// FIXME should both operations happen inside the same transaction?

	// update dashboard_public_config
	err = d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// if we have a uid, public dashboard config exists. delete it
		// otherwise generate a uid
		if cmd.PublicDashboardConfig.PublicDashboard.Uid != "" {
			if _, err = sess.Exec("DELETE FROM dashboard_public_config WHERE uid=?", cmd.PublicDashboardConfig.PublicDashboard.Uid); err != nil {
				return err
			}

		} else {
			uid, err := generateNewPublicDashboardUid(sess)
			if err != nil {
				return errutil.Wrapf(err, "Failed to generate UID for public dashboard")
			}
			cmd.PublicDashboardConfig.PublicDashboard.Uid = uid
		}

		if _, err := sess.Insert(&cmd.PublicDashboardConfig.PublicDashboard); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &cmd.PublicDashboardConfig, nil
}
