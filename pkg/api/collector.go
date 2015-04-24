package api

import (
	"github.com/grafana/grafana/pkg/bus"
	//"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetCollectors(c *middleware.Context, query m.GetCollectorsQuery) {
	query.OrgId = c.OrgId

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query collectors", err)
		return
	}
	c.JSON(200, query.Result)
}

func getCollectorHealthById(c *middleware.Context) {
	id := c.ParamsInt64(":id")
	query := m.GetCollectorHealthByIdQuery{
		Id:    id,
		OrgId: c.OrgId,
	}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Failed to query collector health", err)
		return
	}

	c.JSON(200, query.Result)
}

func GetCollectorById(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetCollectorByIdQuery{Id: id, OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Collector not found", nil)
		return
	}

	c.JSON(200, query.Result)
}

func DeleteCollector(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteCollectorCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete collector", err)
		return
	}

	c.JsonOK("collector deleted")
}

func AddCollector(c *middleware.Context, cmd m.AddCollectorCommand) {
	cmd.OrgId = c.OrgId

	if cmd.Public {
		if !c.IsGrafanaAdmin {
			c.JsonApiErr(400, "Only admins can make public collectors", nil)
			return
		}
	}
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add collector", err)
		return
	}

	c.JSON(200, cmd.Result)
}

func UpdateCollector(c *middleware.Context, cmd m.UpdateCollectorCommand) {
	cmd.OrgId = c.OrgId

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update collector", err)
		return
	}

	c.JsonOK("Collector updated")
}
