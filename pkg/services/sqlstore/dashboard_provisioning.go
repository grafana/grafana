package sqlstore

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) addDashboardProvisioningQueryAndCommandHandlers() {
	bus.AddHandler("sql", ss.DeleteOrphanedProvisionedDashboards)
}

type DashboardExtras struct {
	Id          int64
	DashboardId int64
	Key         string
	Value       string
}

func (ss *SQLStore) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
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
		err := ss.DeleteDashboard(ctx, &models.DeleteDashboardCommand{Id: deleteDashCommand.DashboardId})
		if err != nil && !errors.Is(err, models.ErrDashboardNotFound) {
			return err
		}
	}

	return nil
}
