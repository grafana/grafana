package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type NotificationsApiHandler struct {
	notificationSrv *NotificationSrv
}

func NewNotificationsApi(notificationSrv *NotificationSrv) *NotificationsApiHandler {
	return &NotificationsApiHandler{
		notificationSrv: notificationSrv,
	}
}

func (f *NotificationsApiHandler) handleRouteNotificationsGetTimeInterval(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.notificationSrv.RouteGetTimeInterval(ctx, name)
}

func (f *NotificationsApiHandler) handleRouteNotificationsGetTimeIntervals(ctx *contextmodel.ReqContext) response.Response {
	return f.notificationSrv.RouteGetTimeIntervals(ctx)
}

func (f *NotificationsApiHandler) handleRouteGetReceiver(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.notificationSrv.RouteGetReceiver(ctx, name)
}

func (f *NotificationsApiHandler) handleRouteGetReceivers(ctx *contextmodel.ReqContext) response.Response {
	return f.notificationSrv.RouteGetReceivers(ctx)
}
