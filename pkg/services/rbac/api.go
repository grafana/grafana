package rbac

import (
	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
)

func (ac *RBACService) registerAPIEndpoints() {
	ac.RouteRegister.Group("/api/access-control", func(accessControl routing.RouteRegister) {
		accessControl.Get("/policies", middleware.ReqSignedIn, routing.Wrap(ac.listPolicies))
		accessControl.Get("/policies/:policyUID", middleware.ReqSignedIn, routing.Wrap(ac.getPolicy))
		accessControl.Post("/policies", middleware.ReqEditorRole, binding.Bind(CreatePolicyCommand{}), routing.Wrap(ac.createPolicy))
		accessControl.Put("/policies/:policyUID", middleware.ReqEditorRole, binding.Bind(UpdatePolicyCommand{}), routing.Wrap(ac.updatePolicy))
		accessControl.Delete("/policies/:policyUID", middleware.ReqEditorRole, routing.Wrap(ac.deletePolicy))
	})
}

// GET /api/access-control/policies
func (ac *RBACService) listPolicies(c *models.ReqContext) response.Response {
	policies, err := ac.GetPolicies(c.Req.Context(), c.OrgId)

	if err != nil {
		return response.Error(500, "Failed to list policies", err)
	}

	return response.JSON(200, policies)
}

// GET /api/access-control/policies/:policyUID
func (ac *RBACService) getPolicy(c *models.ReqContext) response.Response {
	policyUID := c.Params(":policyUID")

	policy, err := ac.GetPolicyByUID(c.Req.Context(), c.OrgId, policyUID)
	if err != nil {
		return response.Error(500, "Failed to get policy", err)
	}

	return response.JSON(200, policy)
}

// POST /api/access-control/policies
func (ac *RBACService) createPolicy(c *models.ReqContext, cmd CreatePolicyCommand) response.Response {
	cmd.OrgId = c.SignedInUser.OrgId

	policy, err := ac.CreatePolicy(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(500, "Failed to create policy", err)
	}

	return response.JSON(200, policy)
}

// PUT /api/access-control/policies/:policyUID
func (ac *RBACService) updatePolicy(c *models.ReqContext, cmd UpdatePolicyCommand) response.Response {
	policyUID := c.Params(":policyUID")
	cmd.UID = policyUID

	policy, err := ac.UpdatePolicy(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(500, "Failed to update policy", err)
	}

	return response.JSON(200, policy)
}

// DELETE /api/access-control/policies/:policyUID
func (ac *RBACService) deletePolicy(c *models.ReqContext) response.Response {
	policyUID := c.Params(":policyUID")

	cmd := &DeletePolicyCommand{
		UID:   policyUID,
		OrgId: c.SignedInUser.OrgId,
	}

	err := ac.DeletePolicy(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete policy", err)
	}

	return response.Success("Policy deleted")
}
