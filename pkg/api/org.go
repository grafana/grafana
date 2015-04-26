package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
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
	if !setting.AllowUserOrgCreate && !c.IsGrafanaAdmin {
		c.JsonApiErr(401, "Access denied", nil)
		return
	}

	cmd.UserId = c.UserId
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create organization", err)
		return
	}

	metrics.M_Api_Org_Create.Inc(1)

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
