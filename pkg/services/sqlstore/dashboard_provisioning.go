package sqlstore

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandlerCtx("sql", UnprovisionDashboard)
	bus.AddHandlerCtx("sql", DeleteOrphanedProvisionedDashboards)
}

type DashboardExtras struct {
	Id          int64
	DashboardId int64
	Key         string
	Value       string
}

func (ss *SQLStore) GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	var data models.DashboardProvisioning
	exists, err := x.Where("dashboard_id = ?", dashboardID).Get(&data)
	if err != nil {
		return nil, err
	}
	if exists {
		return &data, nil
	}
	return nil, nil
}

func (ss *SQLStore) SaveProvisionedDashboard(cmd models.SaveDashboardCommand,
	provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		if err := saveDashboard(sess, &cmd); err != nil {
			return err
		}

		if provisioning.Updated == 0 {
			provisioning.Updated = cmd.Result.Updated.Unix()
		}

		return saveProvisionedData(sess, provisioning, cmd.Result)
	})

	return cmd.Result, err
}

func saveProvisionedData(sess *DBSession, provisioning *models.DashboardProvisioning, dashboard *models.Dashboard) error {
	result := &models.DashboardProvisioning{}

	exist, err := sess.Where("dashboard_id=? AND name = ?", dashboard.Id, provisioning.Name).Get(result)
	if err != nil {
		return err
	}

	provisioning.Id = result.Id
	provisioning.DashboardId = dashboard.Id

	if exist {
		_, err = sess.ID(result.Id).Update(provisioning)
	} else {
		_, err = sess.Insert(provisioning)
	}

	return err
}

func (ss *SQLStore) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	var result []*models.DashboardProvisioning
	if err := ss.engine.Where("name = ?", name).Find(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// UnprovisionDashboard removes row in dashboard_provisioning for the dashboard making it seem as if manually created.
// The dashboard will still have `created_by = -1` to see it was not created by any particular user.
func UnprovisionDashboard(ctx context.Context, cmd *models.UnprovisionDashboardCommand) error {
	if _, err := x.Where("dashboard_id = ?", cmd.Id).Delete(&models.DashboardProvisioning{}); err != nil {
		return err
	}
	return nil
}

func DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
	var result []*models.DashboardProvisioning

	convertedReaderNames := make([]interface{}, len(cmd.ReaderNames))
	for index, readerName := range cmd.ReaderNames {
		convertedReaderNames[index] = readerName
	}

	err := x.NotIn("name", convertedReaderNames...).Find(&result)
	if err != nil {
		return err
	}

	for _, deleteDashCommand := range result {
		err := DeleteDashboard(ctx, &models.DeleteDashboardCommand{Id: deleteDashCommand.DashboardId})
		if err != nil && !errors.Is(err, models.ErrDashboardNotFound) {
			return err
		}
	}

	return nil
}
