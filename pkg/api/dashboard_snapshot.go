package api

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func CreateDashboardSnapshot(c *middleware.Context, cmd m.CreateDashboardSnapshotCommand) {
	cmd.Key = util.GetRandomString(32)

	if cmd.External {
		cmd.OrgId = -1
		metrics.M_Api_Dashboard_Snapshot_External.Inc(1)
	} else {
		cmd.OrgId = c.OrgId
		metrics.M_Api_Dashboard_Snapshot_Create.Inc(1)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create snaphost", err)
		return
	}

	c.JSON(200, util.DynMap{"key": cmd.Key, "url": setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key)})
}

func GetDashboardSnapshot(c *middleware.Context) {
	key := c.Params(":key")

	query := &m.GetDashboardSnapshotQuery{Key: key}

	err := bus.Dispatch(query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get dashboard snapshot", err)
		return
	}

	snapshot := query.Result

	// expired snapshots should also be removed from db
	if snapshot.Expires.Before(time.Now()) {
		c.JsonApiErr(404, "Snapshot not found", err)
		return
	}

	dto := dtos.Dashboard{
		Model: snapshot.Dashboard,
		Meta:  dtos.DashboardMeta{IsSnapshot: true},
	}

	metrics.M_Api_Dashboard_Snapshot_Get.Inc(1)

	maxAge := int64(snapshot.Expires.Sub(time.Now()).Seconds())

	c.Resp.Header().Set("Cache-Control", "public, max-age="+strconv.FormatInt(maxAge, 10))

	c.JSON(200, dto)
}
