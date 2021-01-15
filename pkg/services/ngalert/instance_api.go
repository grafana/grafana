package ngalert

import (
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/models"
)

// listAlertInstancesEndpoint handles GET /api/alert-instances.
func (ng *AlertNG) listAlertInstancesEndpoint(c *models.ReqContext) api.Response {
	cmd := listAlertInstancesQuery{DefinitionOrgID: c.SignedInUser.OrgId}

	if err := ng.listAlertInstances(&cmd); err != nil {
		return api.Error(500, "Failed to list alert instances", err)
	}

	return api.JSON(200, cmd.Result)
}
