package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ProvisioningApiHandler struct {
	svc *ProvisioningSrv
}

func NewProvisioningApi(svc *ProvisioningSrv) *ProvisioningApiHandler {
	return &ProvisioningApiHandler{
		svc: svc,
	}
}

func (f *ProvisioningApiHandler) handleRouteGetPolicyTree(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetPolicyTree(ctx)
}

func (f *ProvisioningApiHandler) handleRoutePutPolicyTree(ctx *contextmodel.ReqContext, route apimodels.Route) response.Response {
	return f.svc.RoutePutPolicyTree(ctx, route)
}

func (f *ProvisioningApiHandler) handleRouteGetContactpoints(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetContactPoints(ctx)
}

func (f *ProvisioningApiHandler) handleRoutePostContactpoints(ctx *contextmodel.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	return f.svc.RoutePostContactPoint(ctx, cp)
}

func (f *ProvisioningApiHandler) handleRoutePutContactpoint(ctx *contextmodel.ReqContext, cp apimodels.EmbeddedContactPoint, UID string) response.Response {
	return f.svc.RoutePutContactPoint(ctx, cp, UID)
}

func (f *ProvisioningApiHandler) handleRouteDeleteContactpoints(ctx *contextmodel.ReqContext, UID string) response.Response {
	return f.svc.RouteDeleteContactPoint(ctx, UID)
}

func (f *ProvisioningApiHandler) handleRouteGetTemplates(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetTemplates(ctx)
}

func (f *ProvisioningApiHandler) handleRouteGetTemplate(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.svc.RouteGetTemplate(ctx, name)
}

func (f *ProvisioningApiHandler) handleRoutePutTemplate(ctx *contextmodel.ReqContext, body apimodels.NotificationTemplateContent, name string) response.Response {
	return f.svc.RoutePutTemplate(ctx, body, name)
}

func (f *ProvisioningApiHandler) handleRouteDeleteTemplate(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.svc.RouteDeleteTemplate(ctx, name)
}

func (f *ProvisioningApiHandler) handleRouteGetMuteTiming(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.svc.RouteGetMuteTiming(ctx, name)
}

func (f *ProvisioningApiHandler) handleRouteGetMuteTimings(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetMuteTimings(ctx)
}

func (f *ProvisioningApiHandler) handleRoutePostMuteTiming(ctx *contextmodel.ReqContext, mt apimodels.MuteTimeInterval) response.Response {
	return f.svc.RoutePostMuteTiming(ctx, mt)
}

func (f *ProvisioningApiHandler) handleRoutePutMuteTiming(ctx *contextmodel.ReqContext, mt apimodels.MuteTimeInterval, name string) response.Response {
	return f.svc.RoutePutMuteTiming(ctx, mt, name)
}

func (f *ProvisioningApiHandler) handleRouteDeleteMuteTiming(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.svc.RouteDeleteMuteTiming(ctx, name)
}

func (f *ProvisioningApiHandler) handleRouteGetAlertRules(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetAlertRules(ctx)
}

func (f *ProvisioningApiHandler) handleRouteGetAlertRule(ctx *contextmodel.ReqContext, UID string) response.Response {
	return f.svc.RouteRouteGetAlertRule(ctx, UID)
}

func (f *ProvisioningApiHandler) handleRouteGetAlertRuleExport(ctx *contextmodel.ReqContext, UID string) response.Response {
	return f.svc.RouteGetAlertRuleExport(ctx, UID)
}

func (f *ProvisioningApiHandler) handleRouteGetAlertRulesExport(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetAlertRulesExport(ctx)
}

func (f *ProvisioningApiHandler) handleRoutePostAlertRule(ctx *contextmodel.ReqContext, ar apimodels.ProvisionedAlertRule) response.Response {
	return f.svc.RoutePostAlertRule(ctx, ar)
}

func (f *ProvisioningApiHandler) handleRoutePutAlertRule(ctx *contextmodel.ReqContext, ar apimodels.ProvisionedAlertRule, UID string) response.Response {
	return f.svc.RoutePutAlertRule(ctx, ar, UID)
}

func (f *ProvisioningApiHandler) handleRouteDeleteAlertRule(ctx *contextmodel.ReqContext, UID string) response.Response {
	return f.svc.RouteDeleteAlertRule(ctx, UID)
}

func (f *ProvisioningApiHandler) handleRouteResetPolicyTree(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteResetPolicyTree(ctx)
}

func (f *ProvisioningApiHandler) handleRouteGetAlertRuleGroup(ctx *contextmodel.ReqContext, folder, group string) response.Response {
	return f.svc.RouteGetAlertRuleGroup(ctx, folder, group)
}

func (f *ProvisioningApiHandler) handleRouteGetAlertRuleGroupExport(ctx *contextmodel.ReqContext, folder, group string) response.Response {
	return f.svc.RouteGetAlertRuleGroupExport(ctx, folder, group)
}

func (f *ProvisioningApiHandler) handleRoutePutAlertRuleGroup(ctx *contextmodel.ReqContext, ag apimodels.AlertRuleGroup, folder, group string) response.Response {
	return f.svc.RoutePutAlertRuleGroup(ctx, ag, folder, group)
}
