package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type UpgradeApiHandler struct {
	svc *UpgradeSrv
}

func NewUpgradeApi(svc *UpgradeSrv) *UpgradeApiHandler {
	return &UpgradeApiHandler{
		svc: svc,
	}
}

func (f *UpgradeApiHandler) handleRoutePostUpgradeOrg(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RoutePostUpgradeOrg(ctx)
}

func (f *UpgradeApiHandler) handleRouteGetOrgUpgrade(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetOrgUpgrade(ctx)
}

func (f *UpgradeApiHandler) handleRouteDeleteOrgUpgrade(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteDeleteOrgUpgrade(ctx)
}

func (f *UpgradeApiHandler) handleRoutePostUpgradeAlert(ctx *contextmodel.ReqContext, dashboardIdParam string, panelIdParam string) response.Response {
	return f.svc.RoutePostUpgradeAlert(ctx, dashboardIdParam, panelIdParam)
}

func (f *UpgradeApiHandler) handleRoutePostUpgradeDashboard(ctx *contextmodel.ReqContext, dashboardIdParam string) response.Response {
	return f.svc.RoutePostUpgradeDashboard(ctx, dashboardIdParam)
}

func (f *UpgradeApiHandler) handleRoutePostUpgradeAllDashboards(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RoutePostUpgradeAllDashboards(ctx)
}

func (f *UpgradeApiHandler) handleRoutePostUpgradeChannel(ctx *contextmodel.ReqContext, channelIdParam string) response.Response {
	return f.svc.RoutePostUpgradeChannel(ctx, channelIdParam)
}

func (f *UpgradeApiHandler) handleRoutePostUpgradeAllChannels(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RoutePostUpgradeAllChannels(ctx)
}
