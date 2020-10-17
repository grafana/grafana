package ngalert

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func validateOrgAlertDefinition(c *models.ReqContext) {
	id := c.ParamsInt64(":alertDefinitionId")
	query := GetAlertDefinitionByIDQuery{ID: id}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(404, "Alert definition not found", nil)
		return
	}

	if c.OrgId != query.Result.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view alert definition", nil)
		return
	}
}
