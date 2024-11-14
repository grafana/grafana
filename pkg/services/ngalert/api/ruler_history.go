package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type HistoryApiHandler struct {
	svc *HistorySrv
}

func NewStateHistoryApi(svc *HistorySrv) *HistoryApiHandler {
	return &HistoryApiHandler{
		svc: svc,
	}
}

func (f *HistoryApiHandler) handleRouteGetStateHistory(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteQueryStateHistory(ctx)
}
