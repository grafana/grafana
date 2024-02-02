package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type NotificationsApiHandler struct {
	muteTimingService MuteTimingService
}

func NewNotificationsApi(muteTimingService MuteTimingService) NotificationsApi {
	return &NotificationsApiHandler{
		muteTimingService: muteTimingService,
	}
}

func (f *NotificationsApiHandler) handleRouteNotificationsGetTimeInterval(ctx *contextmodel.ReqContext, name string) response.Response {
	model, err := f.muteTimingService.GetMuteTiming(ctx.Req.Context(), name, ctx.OrgID)
	if err != nil {
		return errorToResponse(err)
	}
	return response.JSON(http.StatusOK, model) // TODO convert to timing interval
}

func (f *NotificationsApiHandler) handleRouteNotificationsGetTimeIntervals(ctx *contextmodel.ReqContext) response.Response {
	model, err := f.muteTimingService.GetMuteTimings(ctx.Req.Context(), ctx.OrgID)
	if err != nil {
		return errorToResponse(err)
	}
	return response.JSON(http.StatusOK, model) // TODO convert to timing interval
}
