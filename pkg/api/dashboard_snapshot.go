package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func CreateDashboardSnapshot(c *middleware.Context, cmd m.CreateDashboardSnapshotCommand) {
	cmd.Key = util.GetRandomString(32)

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create snaphost", err)
		return
	}

	metrics.M_Api_Dashboard_Snapshot_Create.Inc(1)

	c.JSON(200, util.DynMap{"key": cmd.Key})
}

func GetDashboardSnapshot(c *middleware.Context) {
	key := c.Params(":key")

	query := &m.GetDashboardSnapshotQuery{Key: key}

	err := bus.Dispatch(query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get dashboard snapshot", err)
		return
	}

	dto := dtos.Dashboard{
		Model: query.Result.Dashboard,
		Meta:  dtos.DashboardMeta{IsSnapshot: true},
	}

	metrics.M_Api_Dashboard_Snapshot_Get.Inc(1)

	c.Resp.Header().Set("Cache-Control", "public, max-age=31536000")

	c.JSON(200, dto)
}
