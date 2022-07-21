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

func (f *ForkedProvisioningApi) forkRoutePutPolicyTree(ctx *models.ReqContext, route apimodels.Route) response.Response {
	return f.svc.RoutePutPolicyTree(ctx, route)
}

func (f *ForkedProvisioningApi) forkRouteResetPolicyTree(ctx *models.ReqContext) response.Response {
	return f.svc.RouteResetPolicyTree(ctx)
}

func (f *ForkedProvisioningApi) forkRouteGetContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetContactPoints(ctx)
}

// LOGZ.IO GRAFANA CHANGE :: DEV-32721 - Internal API to manage contact points
func (f *ForkedProvisioningApi) forkRouteInternalGetContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteInternalGetContactPoints(ctx)
}

// LOGZ.IO GRAFANA CHANGE :: end

func (f *ForkedProvisioningApi) forkRoutePostContactpoints(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	return f.svc.RoutePostContactPoint(ctx, cp)
}

func (f *ForkedProvisioningApi) forkRoutePutContactpoint(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint, UID string) response.Response {
	return f.svc.RoutePutContactPoint(ctx, cp, UID)
}

// LOGZ.IO GRAFANA CHANGE :: DEV-32721 - Internal API to manage contact points
func (f *ForkedProvisioningApi) forkRouteInternalPutContactpoint(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint, UID string) response.Response {
	return f.svc.RouteInternalPutContactPoint(ctx, cp, UID)
}

// LOGZ.IO GRAFANA CHANGE :: end

func (f *ForkedProvisioningApi) forkRouteDeleteContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteDeleteContactPoint(ctx)
}

// LOGZ.IO GRAFANA CHANGE :: DEV-32721 - Internal API to manage contact points
func (f *ForkedProvisioningApi) forkRouteInternalDeleteContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteInternalDeleteContactPoint(ctx)
}

// LOGZ.IO GRAFANA CHANGE :: end

// LOGZ.IO GRAFANA CHANGE :: DEV-33330 - API to return all alert rules
func (f *ForkedProvisioningApi) forkRouteGetAlertRules(ctx *models.ReqContext) response.Response {
	return f.svc.RouteRouteGetAlertRules(ctx)
}

// LOGZ.IO GRAFANA CHANGE :: end

func (f *ForkedProvisioningApi) forkRouteGetAlertRule(ctx *models.ReqContext, UID string) response.Response {
	return f.svc.RouteRouteGetAlertRule(ctx, UID)
}

func (f *ForkedProvisioningApi) forkRoutePostAlertRule(ctx *models.ReqContext, ar apimodels.AlertRule) response.Response {
	return f.svc.RoutePostAlertRule(ctx, ar)
}

func (f *ForkedProvisioningApi) forkRoutePutAlertRule(ctx *models.ReqContext, ar apimodels.AlertRule, UID string) response.Response {
	return f.svc.RoutePutAlertRule(ctx, ar, UID)
}

func (f *ForkedProvisioningApi) forkRouteDeleteAlertRule(ctx *models.ReqContext, UID string) response.Response {
	return f.svc.RouteDeleteAlertRule(ctx, UID)
}

func (f *ForkedProvisioningApi) forkRoutePutAlertRuleGroup(ctx *models.ReqContext, ag apimodels.AlertRuleGroup, folder, group string) response.Response {
	return f.svc.RoutePutAlertRuleGroup(ctx, ag, folder, group)
}
