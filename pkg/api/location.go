package api

import (
	"github.com/grafana/grafana/pkg/bus"
	//"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetLocations(c *middleware.Context, query m.GetLocationsQuery) {
	query.OrgId = c.OrgId

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query locations", err)
		return
	}
	c.JSON(200, query.Result)
}

func GetLocationById(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetLocationByIdQuery{Id: id, OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Location not found", nil)
		return
	}

	c.JSON(200, query.Result)
}

func DeleteLocation(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteLocationCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete location", err)
		return
	}

	c.JsonOK("location deleted")
}

func AddLocation(c *middleware.Context) {
	cmd := m.AddLocationCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.OrgId = c.OrgId
	if cmd.Public {
		if c.OrgRole != m.ROLE_RAINTANK_ADMIN {
			c.JsonApiErr(400, "Only raintank admins can make public locations", nil)
			return
		}
	}
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add location", err)
		return
	}

	c.JSON(200, cmd.Result)
}

func UpdateLocation(c *middleware.Context) {
	cmd := m.UpdateLocationCommand{}
	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.OrgId = c.OrgId

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update location", err)
		return
	}

	c.JsonOK("Location updated")
}
