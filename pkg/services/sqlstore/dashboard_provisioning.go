package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetProvisionedDashboardDataQuery)
	bus.AddHandler("sql", SaveProvisionedDashboard)
	bus.AddHandler("sql", GetProvisionedDataByDashboardId)
	bus.AddHandler("sql", UnprovisionDashboard)
}

type DashboardExtras struct {
	Id          int64
	DashboardId int64
	Key         string
	Value       string
}

func GetProvisionedDataByDashboardId(cmd *models.IsDashboardProvisionedQuery) error {
	result := &models.DashboardProvisioning{}

	exist, err := x.Where("dashboard_id = ?", cmd.DashboardId).Get(result)
	if err != nil {
		return err
	}

	cmd.Result = exist

	return nil
}

func SaveProvisionedDashboard(cmd *models.SaveProvisionedDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		err := saveDashboard(sess, cmd.DashboardCmd)

		if err != nil {
			return err
		}

		cmd.Result = cmd.DashboardCmd.Result
		if cmd.DashboardProvisioning.Updated == 0 {
			cmd.DashboardProvisioning.Updated = cmd.Result.Updated.Unix()
		}

		return saveProvisionedData(sess, cmd.DashboardProvisioning, cmd.Result)
	})
}

func saveProvisionedData(sess *DBSession, cmd *models.DashboardProvisioning, dashboard *models.Dashboard) error {
	result := &models.DashboardProvisioning{}

	exist, err := sess.Where("dashboard_id=? AND name = ?", dashboard.Id, cmd.Name).Get(result)
	if err != nil {
		return err
	}

	cmd.Id = result.Id
	cmd.DashboardId = dashboard.Id

	if exist {
		_, err = sess.ID(result.Id).Update(cmd)
	} else {
		_, err = sess.Insert(cmd)
	}

	return err
}

func GetProvisionedDashboardDataQuery(cmd *models.GetProvisionedDashboardDataQuery) error {
	var result []*models.DashboardProvisioning

	if err := x.Where("name = ?", cmd.Name).Find(&result); err != nil {
		return err
	}

	cmd.Result = result
	return nil
}

// UnprovisionDashboard removes row in dashboard_provisioning for the dashboard making it seem as if manually created.
// The dashboard will still have `created_by = -1` to see it was not created by any particular user.
func UnprovisionDashboard(cmd *models.UnprovisionDashboardCommand) error {
	if _, err := x.Where("dashboard_id = ?", cmd.Id).Delete(&models.DashboardProvisioning{}); err != nil {
		return err
	}
	return nil
}
