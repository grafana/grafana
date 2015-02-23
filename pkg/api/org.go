package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetOrg(c *middleware.Context) {
	query := m.GetOrgByIdQuery{Id: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrOrgNotFound {
			c.JsonApiErr(404, "Organization not found", err)
			return
		}

		c.JsonApiErr(500, "Failed to get organization", err)
		return
	}

	org := m.OrgDTO{
		Id:   query.Result.Id,
		Name: query.Result.Name,
	}

	c.JSON(200, &org)
}

func CreateOrg(c *middleware.Context, cmd m.CreateOrgCommand) {
	cmd.UserId = c.UserId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create organization", err)
		return
	}

	c.JsonOK("Organization created")
}

func UpdateOrg(c *middleware.Context, cmd m.UpdateOrgCommand) {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to update organization", err)
		return
	}

	c.JsonOK("Organization updated")
}
