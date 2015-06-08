package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetAlerts(c *middleware.Context) {
	query := m.GetAlertsQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to list alerts", err)
		return
	}
	c.JSON(200, query.Result)
}

func GetAlertById(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetAlertByIdQuery{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Alert not found", nil)
		return
	}

	c.JSON(200, query.Result)
}

func DeleteAlert(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteAlertCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete alert", err)
		return
	}

	c.JsonOK("Alert deleted")
}

func AddAlert(c *middleware.Context, cmd m.AddAlertCommand) {
	cmd.OrgId = c.OrgId
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add alert", err)
		return
	}
	c.JSON(200, cmd.Result)
}
