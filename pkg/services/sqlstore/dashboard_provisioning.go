package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetProvisionedDashboardDataQuery)
	bus.AddHandler("sql", SaveProvisionedDashboard)
}

type DashboardExtras struct {
	Id          int64
	DashboardId int64
	Key         string
	Value       string
}

func SaveProvisionedDashboard(cmd *models.SaveProvisionedDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		err := saveDashboard(sess, cmd.DashboardCmd)

		if err != nil {
			return err
		}

		cmd.Result = cmd.DashboardCmd.Result
		if cmd.DashboardProvisioning.Updated.IsZero() {
			cmd.DashboardProvisioning.Updated = cmd.Result.Updated
		}

		return saveProvionedData(sess, cmd.DashboardProvisioning, cmd.Result)
	})
}

func saveProvionedData(sess *DBSession, cmd *models.DashboardProvisioning, dashboard *models.Dashboard) error {
	result := &models.DashboardProvisioning{}

	exist, err := sess.Where("dashboard_id=?", dashboard.Id).Get(result)
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
