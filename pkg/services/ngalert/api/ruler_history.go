package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

type StateHistoryApiHandler struct {
	svc *HistorySrv
}

func NewStateHistoryApi(svc *HistorySrv) *StateHistoryApiHandler {
	return &StateHistoryApiHandler{
		svc: svc,
	}
}

func (f *StateHistoryApiHandler) handleRouteGetStateHistory(ctx *models.ReqContext) response.Response {
	return f.svc.RouteQueryStateHistory(ctx)
}
