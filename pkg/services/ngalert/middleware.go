package ngalert

import (
	"github.com/grafana/grafana/pkg/models"
)

func (api *apiImpl) validateOrgAlertDefinition(c *models.ReqContext) {
	uid := c.ParamsEscape(":alertDefinitionUID")

	if uid == "" {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	query := getAlertDefinitionByUIDQuery{UID: uid, OrgID: c.SignedInUser.OrgId}

	if err := api.store.getAlertDefinitionByUID(&query); err != nil {
		c.JsonApiErr(404, "Alert definition not found", nil)
		return
	}
}
