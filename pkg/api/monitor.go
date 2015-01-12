package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)


func GetMonitorById(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetMonitorByIdQuery{Id: id, AccountId: c.GetAccountId()}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Monitor not found", nil)
		return
	}

	c.JSON(200, query.Result)
}

func GetMonitors(c *middleware.Context) {
	query := m.GetMonitorsQuery{AccountId: c.Account.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to query monitors", err)
		return
	}
	c.JSON(200, query.Result)
}

func GetMonitorTypes(c * middleware.Context) {
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

	cmd := &m.DeleteMonitorCommand{Id: id, AccountId: c.UserAccount.Id}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete monitor", err)
		return
	}

	c.JsonOK("monitor deleted")
}

func AddMonitor(c *middleware.Context) {
	cmd := m.AddMonitorCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.Account.Id

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add monitor", err)
		return
	}

	c.JSON(200, cmd.Result)
}