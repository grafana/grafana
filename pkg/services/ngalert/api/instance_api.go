package api

import (
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

// listAlertInstancesEndpoint handles GET /api/alert-instances.
func (api *API) listAlertInstancesEndpoint(c *models.ReqContext) response.Response {
	cmd := ngmodels.ListAlertInstancesQuery{DefinitionOrgID: c.SignedInUser.OrgId}

	if err := api.Store.ListAlertInstances(&cmd); err != nil {
		return response.Error(500, "Failed to list alert instances", err)
	}

	return response.JSON(200, cmd.Result)
}
