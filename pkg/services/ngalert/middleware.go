package ngalert

import (
	"github.com/grafana/grafana/pkg/models"
)

func (ng *AlertNG) validateOrgAlertDefinition(c *models.ReqContext) {
	id := c.ParamsInt64(":alertDefinitionId")
	query := getAlertDefinitionByIDQuery{ID: id}

	if err := ng.getAlertDefinitionByID(&query); err != nil {
		c.JsonApiErr(404, "Alert definition not found", nil)
		return
	}

	if c.OrgId != query.Result.OrgID {
		c.JsonApiErr(403, "You are not allowed to edit/view alert definition", nil)
		return
	}
}
