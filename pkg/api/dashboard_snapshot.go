package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func CreateDashboardSnapshotCommand(c *middleware.Context, cmd m.CreateDashboardSnapshotCommand) {
	cmd.Key = util.GetRandomString(20)

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create snaphost", err)
		return
	}

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

	c.JSON(200, query.Result)
}
