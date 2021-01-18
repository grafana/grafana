package ngalert

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

// listAlertInstancesEndpoint handles GET /api/alert-instances.
func (ng *AlertNG) listAlertInstancesEndpoint(c *models.ReqContext) response.Response {
	cmd := listAlertInstancesQuery{DefinitionOrgID: c.SignedInUser.OrgId}

	if err := ng.listAlertInstances(&cmd); err != nil {
		return response.Error(500, "Failed to list alert instances", err)
	}

	return response.JSON(200, cmd.Result)
}
