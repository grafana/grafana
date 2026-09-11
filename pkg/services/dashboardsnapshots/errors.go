package dashboardsnapshots

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var ErrBaseNotFound = errutil.NotFound("dashboardsnapshots.not-found", errutil.WithPublicMessage("Snapshot not found"))

var ErrDashboardSnapshotAlreadyExists = errutil.Conflict("dashboardsnapshots.keyAlreadyExists", errutil.WithPublicMessage("Snapshot key already exists"))
