package dashboardsnapshots

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrBaseNotFound = errutil.NotFound("dashboardsnapshots.not-found", errutil.WithPublicMessage("Snapshot not found"))
