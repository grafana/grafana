package sqlstore

import (
	"time"

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
		return saveProvionedData(sess, cmd.DashboardProvisioning)
	})
}

func saveProvionedData(sess *DBSession, cmd *models.DashboardProvisioning) error {
	results := &models.DashboardProvisioning{}

	exist, err := sess.Where("dashboard_id=?", cmd.DashboardId).Get(results)
	if err != nil {
		return err
	}

	cmd.Id = results.Id
	cmd.Updated = time.Now()

	println("exists", exist)
	if exist {

		_, err = sess.ID(results.Id).Update(cmd)
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
