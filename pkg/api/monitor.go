package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetMonitorById(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetMonitorByIdQuery{Id: id, OrgId: c.OrgId}
	query.IsGrafanaAdmin = c.IsGrafanaAdmin

	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Monitor not found", nil)
		return
	}

	c.JSON(200, query.Result)
}

func getMonitorHealthById(c *middleware.Context) {
	id := c.ParamsInt64(":id")
	query := m.GetMonitorHealthByIdQuery{
		Id:    id,
		OrgId: c.OrgId,
	}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Failed to query monitor health", err)
		return
	}

	c.JSON(200, query.Result)
}

func GetMonitors(c *middleware.Context, query m.GetMonitorsQuery) {
	query.OrgId = c.OrgId
	query.IsGrafanaAdmin = c.IsGrafanaAdmin

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query monitors", err)
		return
	}
	c.JSON(200, query.Result)
}

func GetMonitorTypes(c *middleware.Context) {
	query := m.GetMonitorTypesQuery{}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to query monitor_types", err)
		return
	}
	c.JSON(200, query.Result)
}

func DeleteMonitor(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteMonitorCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete monitor", err)
		return
	}

	c.JsonOK("monitor deleted")
}

func AddMonitor(c *middleware.Context, cmd m.AddMonitorCommand) {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add monitor", err)
		return
	}

	c.JSON(200, cmd.Result)
}

func UpdateMonitor(c *middleware.Context, cmd m.UpdateMonitorCommand) {
	cmd.OrgId = c.OrgId

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update monitor", err)
		return
	}

	c.JsonOK("Monitor updated")
}

func UpdateMonitorCollectorState(c *middleware.Context, cmd m.UpdateMonitorCollectorStateCommand) {
	if cmd.EndpointId == 0 {
		c.JsonApiErr(400, "EndpointId not set.", nil)
		return
	}
	if cmd.MonitorId == 0 {
		c.JsonApiErr(400, "MonitorId not set.", nil)
		return
	}
	if cmd.CollectorId == 0 {
		c.JsonApiErr(400, "CollectorId not set.", nil)
		return
	}
	if cmd.OrgId == 0 {
		c.JsonApiErr(400, "OrgId not set.", nil)
		return
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update monitor collector state", err)
		return
	}

	c.JsonOK("Monitor Collector State updated")
}
