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

func (f *ForkedProvisioningApi) forkRouteGetContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetContactPoints(ctx)
}

func (f *ForkedProvisioningApi) forkRoutePostContactpoints(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	return f.svc.RoutePostContactPoint(ctx, cp)
}

func (f *ForkedProvisioningApi) forkRoutePutContactpoints(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	return f.svc.RoutePutContactPoint(ctx, cp)
}

func (f *ForkedProvisioningApi) forkRouteDeleteContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteDeleteContactPoint(ctx)
}

func (f *ForkedProvisioningApi) forkRouteGetTemplates(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetTemplates(ctx)
}

func (f *ForkedProvisioningApi) forkRouteGetTemplate(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetTemplate(ctx)
}
