package dashsnapimpl

import (
	"context"

	dashsnapshot "github.com/grafana/grafana/pkg/services/dashboardsnapshot"
)

type store interface {
	CreateDashboardSnapshot(context.Context, *dashsnapshot.CreateDashboardSnapshotCommand) error
	DeleteDashboardSnapshot(context.Context, *dashsnapshot.DeleteDashboardSnapshotCommand) error
	DeleteExpiredSnapshots(context.Context, *dashsnapshot.DeleteExpiredSnapshotsCommand) error
	GetDashboardSnapshot(context.Context, *dashsnapshot.GetDashboardSnapshotQuery) error
	SearchDashboardSnapshots(context.Context, *dashsnapshot.GetDashboardSnapshotsQuery) error
}
