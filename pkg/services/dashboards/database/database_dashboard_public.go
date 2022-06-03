package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// retrieves public dashboard configuration
func (d *DashboardStore) GetPublicDashboard(uid string) (*models.PublicDashboard, *models.Dashboard, error) {
	if uid == "" {
		return nil, nil, models.ErrPublicDashboardIdentifierNotSet
	}

	// get public dashboard
	pdRes := &models.PublicDashboard{Uid: uid}
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(pdRes)
		if err != nil {
			return err
		}
		if !has {
			return models.ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	// find dashboard
	dashRes := &models.Dashboard{OrgId: pdRes.OrgId, Uid: pdRes.DashboardUid}
	err = d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(dashRes)
		if err != nil {
			return err
		}
		if !has {
			return models.ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	return pdRes, dashRes, err
}

// generates a new unique uid to retrieve a public dashboard
func generateNewPublicDashboardUid(sess *sqlstore.DBSession) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Get(&models.PublicDashboard{Uid: uid})
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
	if dashboardUid == "" {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	// get dashboard and publicDashboard
	dashRes := &models.Dashboard{OrgId: orgId, Uid: dashboardUid}
	pdRes := &models.PublicDashboard{OrgId: orgId, DashboardUid: dashboardUid}
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// dashboard
		has, err := sess.Get(dashRes)
		if err != nil {
			return err
		}
		if !has {
			return models.ErrDashboardNotFound
		}

		// publicDashboard
		_, err = sess.Get(pdRes)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	pdc := &models.PublicDashboardConfig{
		IsPublic:        dashRes.IsPublic,
		PublicDashboard: *pdRes,
	}

	return pdc, err
}

// persists public dashboard configuration
func (d *DashboardStore) SavePublicDashboardConfig(cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboardConfig, error) {
	if len(cmd.PublicDashboardConfig.PublicDashboard.DashboardUid) == 0 {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// update isPublic on dashboard entry
		affectedRowCount, err := sess.Table("dashboard").Where("org_id = ? AND uid = ?", cmd.OrgId, cmd.DashboardUid).Update(map[string]interface{}{"is_public": cmd.PublicDashboardConfig.IsPublic})
		if err != nil {
			return err
		}

		if affectedRowCount == 0 {
			return models.ErrDashboardNotFound
		}

		// update dashboard_public_config
		// if we have a uid, public dashboard config exists. delete it otherwise generate a uid
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

		_, err = sess.Insert(&cmd.PublicDashboardConfig.PublicDashboard)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &cmd.PublicDashboardConfig, nil
}
