package database

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// retrieves public dashboard configuration
func (d *DashboardStore) GetPublicDashboard(ctx context.Context, uid string) (*models.PublicDashboard, *models.Dashboard, error) {
	if uid == "" {
		return nil, nil, models.ErrPublicDashboardIdentifierNotSet
	}

	// get public dashboard
	pdRes := &models.PublicDashboard{Uid: uid}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
func (d *DashboardStore) GetPublicDashboardConfig(orgId int64, dashboardUid string) (*models.PublicDashboard, error) {
	if dashboardUid == "" {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	pdRes := &models.PublicDashboard{OrgId: orgId, DashboardUid: dashboardUid}
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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
func (d *DashboardStore) SavePublicDashboardConfig(cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboard, error) {
	if len(cmd.PublicDashboard.DashboardUid) == 0 {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// update dashboard_public
		// if we have a uid, public dashboard config exists. delete it otherwise generate a uid
		if cmd.PublicDashboard.Uid != "" {
			if _, err := sess.Exec("DELETE FROM dashboard_public WHERE uid=?", cmd.PublicDashboard.Uid); err != nil {
				return err
			}
		} else {
			uid, err := generateNewPublicDashboardUid(sess)
			if err != nil {
				return fmt.Errorf("failed to generate UID for public dashboard: %w", err)
			}

			cmd.PublicDashboard.Uid = uid
		}

		_, err := sess.Insert(&cmd.PublicDashboard)
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
