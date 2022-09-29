package dashboardsnapshots

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrBaseNotFound = errutil.NewBase(errutil.StatusNotFound, "dashboardsnapshots.not-found", errutil.WithPublicMessage("Snapshot not found"))
