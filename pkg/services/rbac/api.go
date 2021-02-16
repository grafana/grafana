package rbac

import (
	"strconv"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
)

func (ac *RBACService) registerAPIEndpoints() {
	ac.RouteRegister.Group("/api/access-control", func(accessControl routing.RouteRegister) {
		accessControl.Get("/policies", middleware.ReqSignedIn, routing.Wrap(ac.listPolicies))
		accessControl.Get("/policies/:policyId", middleware.ReqSignedIn, routing.Wrap(ac.getPolicy))
		accessControl.Post("/policies", middleware.ReqEditorRole, binding.Bind(CreatePolicyCommand{}), routing.Wrap(ac.createPolicy))
		accessControl.Put("/policies/:policyId", middleware.ReqEditorRole, binding.Bind(UpdatePolicyCommand{}), routing.Wrap(ac.updatePolicy))
		accessControl.Delete("/policies/:policyId", middleware.ReqEditorRole, routing.Wrap(ac.deletePolicy))
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

// GET /api/access-control/policies/:policyId
func (ac *RBACService) getPolicy(c *models.ReqContext) response.Response {
	// TODO: use UID for policies?
	policyIdStr := c.Params(":policyId")
	policyId, err := strconv.Atoi(policyIdStr)
	if err != nil {
		return response.Error(500, "Failed to get policy", err)
	}

	policy, err := ac.GetPolicy(c.Req.Context(), c.OrgId, int64(policyId))
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

// PUT /api/access-control/policies/:policyId
func (ac *RBACService) updatePolicy(c *models.ReqContext, cmd UpdatePolicyCommand) response.Response {
	// TODO: use UID for policies?
	policyIdStr := c.Params(":policyId")
	policyId, err := strconv.Atoi(policyIdStr)
	if err != nil {
		return response.Error(500, "Failed to update policy", err)
	}
	cmd.Id = int64(policyId)

	policy, err := ac.UpdatePolicy(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(500, "Failed to update policy", err)
	}

	return response.JSON(200, policy)
}

// DELETE /api/access-control/policies/:policyId
func (ac *RBACService) deletePolicy(c *models.ReqContext) response.Response {
	// TODO: use UID for policies?
	policyIdStr := c.Params(":policyId")
	policyId, err := strconv.Atoi(policyIdStr)
	if err != nil {
		return response.Error(500, "Failed to delete policy", err)
	}

	cmd := &DeletePolicyCommand{
		Id:    int64(policyId),
		OrgId: c.SignedInUser.OrgId,
	}

	err = ac.DeletePolicy(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete policy", err)
	}

	return response.Success("Policy deleted")
}
