package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ProvisioningApi struct {
	svc *ProvisioningSrv
}

func NewProvisioningApi(svc *ProvisioningSrv) *ProvisioningApi {
	return &ProvisioningApi{
		svc: svc,
	}
}

func (f *ProvisioningApi) handleRouteGetPolicyTree(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetPolicyTree(ctx)
}

func (f *ProvisioningApi) handleRoutePutPolicyTree(ctx *models.ReqContext, route apimodels.Route) response.Response {
	return f.svc.RoutePutPolicyTree(ctx, route)
}

func (f *ProvisioningApi) handleRouteGetContactpoints(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetContactPoints(ctx)
}

func (f *ProvisioningApi) handleRoutePostContactpoints(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	return f.svc.RoutePostContactPoint(ctx, cp)
}

func (f *ProvisioningApi) handleRoutePutContactpoint(ctx *models.ReqContext, cp apimodels.EmbeddedContactPoint, UID string) response.Response {
	return f.svc.RoutePutContactPoint(ctx, cp, UID)
}

func (f *ProvisioningApi) handleRouteDeleteContactpoints(ctx *models.ReqContext, UID string) response.Response {
	return f.svc.RouteDeleteContactPoint(ctx, UID)
}

func (f *ProvisioningApi) handleRouteGetTemplates(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetTemplates(ctx)
}

func (f *ProvisioningApi) handleRouteGetTemplate(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteGetTemplate(ctx, name)
}

func (f *ProvisioningApi) handleRoutePutTemplate(ctx *models.ReqContext, body apimodels.MessageTemplateContent, name string) response.Response {
	return f.svc.RoutePutTemplate(ctx, body, name)
}

func (f *ProvisioningApi) handleRouteDeleteTemplate(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteDeleteTemplate(ctx, name)
}

func (f *ProvisioningApi) handleRouteGetMuteTiming(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteGetMuteTiming(ctx, name)
}

func (f *ProvisioningApi) handleRouteGetMuteTimings(ctx *models.ReqContext) response.Response {
	return f.svc.RouteGetMuteTimings(ctx)
}

func (f *ProvisioningApi) handleRoutePostMuteTiming(ctx *models.ReqContext, mt apimodels.MuteTimeInterval) response.Response {
	return f.svc.RoutePostMuteTiming(ctx, mt)
}

func (f *ProvisioningApi) handleRoutePutMuteTiming(ctx *models.ReqContext, mt apimodels.MuteTimeInterval, name string) response.Response {
	return f.svc.RoutePutMuteTiming(ctx, mt, name)
}

func (f *ProvisioningApi) handleRouteDeleteMuteTiming(ctx *models.ReqContext, name string) response.Response {
	return f.svc.RouteDeleteMuteTiming(ctx, name)
}

func (f *ProvisioningApi) handleRouteGetAlertRule(ctx *models.ReqContext, UID string) response.Response {
	return f.svc.RouteRouteGetAlertRule(ctx, UID)
}

func (f *ProvisioningApi) handleRoutePostAlertRule(ctx *models.ReqContext, ar apimodels.AlertRule) response.Response {
	return f.svc.RoutePostAlertRule(ctx, ar)
}

func (f *ProvisioningApi) handleRoutePutAlertRule(ctx *models.ReqContext, ar apimodels.AlertRule, UID string) response.Response {
	return f.svc.RoutePutAlertRule(ctx, ar, UID)
}

func (f *ProvisioningApi) handleRouteDeleteAlertRule(ctx *models.ReqContext, UID string) response.Response {
	return f.svc.RouteDeleteAlertRule(ctx, UID)
}

func (f *ProvisioningApi) handleRouteGetAlertRuleGroup(ctx *models.ReqContext, folder, group string) response.Response {
	return f.svc.RouteGetAlertRuleGroup(ctx, folder, group)
}

func (f *ProvisioningApi) handleRoutePutAlertRuleGroup(ctx *models.ReqContext, ag apimodels.AlertRuleGroupMetadata, folder, group string) response.Response {
	return f.svc.RoutePutAlertRuleGroup(ctx, ag, folder, group)
}
