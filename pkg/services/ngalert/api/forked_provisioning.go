package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedProvisioningApi always forwards requests to a Grafana backend.
// We do not currently support provisioning of external systems through Grafana's API.
type ForkedProvisioningApi struct {
	svc *ProvisioningSrv
}

// NewForkedProvisioningApi creates a new ForkedProvisioningApi instance.
func NewForkedProvisioningApi(svc *ProvisioningSrv) *ForkedProvisioningApi {
	return &ForkedProvisioningApi{
		svc: svc,
	}
}

func (f *ForkedProvisioningApi) forkRouteGetPolicyTree(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetPolicyTree(ctx)
}

func (f *ForkedProvisioningApi) forkRoutePostPolicyTree(ctx *models.ReqContext, route apimodels.Route) response.Response {
	return f.svc.RoutePostPolicyTree(ctx, route)
}
