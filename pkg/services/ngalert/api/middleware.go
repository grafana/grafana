package api

import (
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/models"
)

func (api *API) validateOrgAlertDefinition(c *models.ReqContext) {
	uid := c.ParamsEscape(":alertDefinitionUID")

	if uid == "" {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	query := ngmodels.GetAlertDefinitionByUIDQuery{UID: uid, OrgID: c.SignedInUser.OrgId}

	if err := api.Store.GetAlertDefinitionByUID(&query); err != nil {
		c.JsonApiErr(404, "Alert definition not found", nil)
		return
	}
}
