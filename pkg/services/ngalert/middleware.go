package ngalert

import (
	"github.com/grafana/grafana/pkg/models"
)

func (ng *AlertNG) validateOrgAlertDefinition(c *models.ReqContext) {
	uid := c.ParamsEscape(":alertDefinitionUID")
	query := getAlertDefinitionByUIDQuery{UID: uid, OrgID: c.SignedInUser.OrgId}

	if err := ng.getAlertDefinitionByUID(&query); err != nil {
		c.JsonApiErr(404, "Alert definition not found", nil)
		return
	}

	if c.OrgId != query.Result.OrgID {
		c.JsonApiErr(403, "You are not allowed to edit/view alert definition", nil)
		return
	}
}
