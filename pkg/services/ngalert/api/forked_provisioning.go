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

func (f *ForkedProvisioningApi) forkRoutePostContactpoints(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	return f.svc.RoutePostContactPoint(ctx, cp)
}

func (f *ForkedProvisioningApi) forkRoutePutContactpoint(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint, UID string) response.Response {
	return f.svc.RoutePutContactPoint(ctx, cp, UID)
}

func (f *ForkedProvisioningApi) forkRouteDeleteContactpoints(ctx *models.ReqContext, UID string) response.Response {
	return f.svc.RouteDeleteContactPoint(ctx, UID)
}

func (f *ForkedProvisioningApi) forkRouteGetTemplates(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetTemplates(ctx)
}

func (f *ForkedProvisioningApi) forkRouteGetTemplate(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteGetTemplate(ctx, name)
}

func (f *ForkedProvisioningApi) forkRoutePutTemplate(ctx *models.ReqContext, body apimodels.MessageTemplateContent, name string) response.Response {
	return f.svc.RoutePutTemplate(ctx, body, name)
}

func (f *ForkedProvisioningApi) forkRouteDeleteTemplate(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteDeleteTemplate(ctx, name)
}

func (f *ForkedProvisioningApi) forkRouteGetMuteTiming(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteGetMuteTiming(ctx, name)
}

func (f *ForkedProvisioningApi) forkRouteGetMuteTimings(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetMuteTimings(ctx)
}

func (f *ForkedProvisioningApi) forkRoutePostMuteTiming(ctx *models.ReqContext, mt apimodels.MuteTimeInterval) response.Response {
	return f.svc.RoutePostMuteTiming(ctx, mt)
}

func (f *ForkedProvisioningApi) forkRoutePutMuteTiming(ctx *models.ReqContext, mt apimodels.MuteTimeInterval, name string) response.Response {
	return f.svc.RoutePutMuteTiming(ctx, mt, name)
}

func (f *ForkedProvisioningApi) forkRouteDeleteMuteTiming(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteDeleteMuteTiming(ctx, name)
}

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

func (f *ForkedProvisioningApi) forkRouteGetAlertRuleGroup(ctx *models.ReqContext, folder, group string) response.Response {
	return f.svc.RouteGetAlertRuleGroup(ctx, folder, group)
}

func (f *ForkedProvisioningApi) forkRoutePutAlertRuleGroup(ctx *models.ReqContext, ag apimodels.AlertRuleGroup, folder, group string) response.Response {
	return f.svc.RoutePutAlertRuleGroup(ctx, ag, folder, group)
}
