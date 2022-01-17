package sqlstore

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", UnprovisionDashboard)
	bus.AddHandler("sql", DeleteOrphanedProvisionedDashboards)
}

type DashboardExtras struct {
	Id          int64
	DashboardId int64
	Key         string
	Value       string
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
