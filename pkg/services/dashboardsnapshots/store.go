package dashboardsnapshots

import (
	"context"
)

type Store interface {
	CreateDashboardSnapshot(context.Context, *CreateDashboardSnapshotCommand) error
	DeleteDashboardSnapshot(context.Context, *DeleteDashboardSnapshotCommand) error
	DeleteExpiredSnapshots(context.Context, *DeleteExpiredSnapshotsCommand) error
	GetDashboardSnapshot(context.Context, *GetDashboardSnapshotQuery) error
	SearchDashboardSnapshots(context.Context, *GetDashboardSnapshotsQuery) error
}
