package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetSiteById(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetSiteByIdQuery{Id: id, AccountId: c.AccountId}

	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Site not found", nil)
		return
	}

	c.JSON(200, query.Result)
}

func GetSites(c *middleware.Context) {
	query := m.GetSitesQuery{AccountId: c.AccountId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query sites", err)
		return
	}
	c.JSON(200, query.Result)
}

func DeleteSite(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteSiteCommand{Id: id, AccountId: c.AccountId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete site", err)
		return
	}

	c.JsonOK("site deleted")
}

func AddSite(c *middleware.Context) {
	cmd := m.AddSiteCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.AccountId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add site", err)
		return
	}

	c.JSON(200, cmd.Result)
}

func UpdateSite(c *middleware.Context) {
	cmd := m.UpdateSiteCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.AccountId

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update site", err)
		return
	}

	c.JsonOK("Site updated")
}
