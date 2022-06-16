package dashboardsnapshots

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Store interface {
	CreateDashboardSnapshot(context.Context, *models.CreateDashboardSnapshotCommand) error
	DeleteDashboardSnapshot(context.Context, *models.DeleteDashboardSnapshotCommand) error
	DeleteExpiredSnapshots(context.Context, *models.DeleteExpiredSnapshotsCommand) error
	GetDashboardSnapshot(context.Context, *models.GetDashboardSnapshotQuery) error
	SearchDashboardSnapshots(context.Context, *models.GetDashboardSnapshotsQuery) error
}
