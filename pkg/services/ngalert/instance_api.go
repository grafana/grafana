package ngalert

import (
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/models"
)

// listAlertInstancesEndpoint handles GET /api/alert-instances.
func (ng *AlertNG) listAlertInstancesEndpoint(c *models.ReqContext) api.Response {
	cmd := listAlertInstancesCommand{OrgID: c.SignedInUser.OrgId}

	if err := ng.listAlertInstances(&cmd); err != nil {
		return api.Error(500, "Failed to list alert instances", err)
	}

	return api.JSON(200, cmd.Result)
}

// createAlertDefinitionEndpoint handles a POST /api/alert-instances to create or save an alert instance.
// This is temporary and not something I think we will expose.
func (ng *AlertNG) saveAlertInstanceEndpoint(c *models.ReqContext, cmd saveAlertInstanceCommand) api.Response {
	cmd.OrgID = c.SignedInUser.OrgId
	cmd.SignedInUser = c.SignedInUser
	cmd.SkipCache = c.SkipCache

	if err := ng.saveAlertInstance(&cmd); err != nil {
		return api.Error(500, "Failed to create alert instance", err)
	}

	return api.Empty(200)
}
