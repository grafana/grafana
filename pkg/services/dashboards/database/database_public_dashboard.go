package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func generateNewPublicDashboardUid(sess *sqlstore.DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.PublicDashboardConfig{})
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
		return sess.Where("org_id = ? AND uid= ?", orgId, dashboardUid).Find(&pdRes)
	})

	if len(pdRes) > 0 {
		pdc.PublicDashboards = pdRes
	}

	return pdc, err
}

// stores public dashboard configuration
func (d *DashboardStore) SavePublicDashboardConfig(cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboardConfig, error) {
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		affectedRowCount, err := sess.Table("dashboard").Where("org_id = ? AND uid = ?", cmd.OrgId, cmd.Uid).Update(map[string]interface{}{"is_public": cmd.PublicDashboardConfig.IsPublic})
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

	return &cmd.PublicDashboardConfig, nil
}
