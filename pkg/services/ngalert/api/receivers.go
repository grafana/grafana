package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type ReceiversApiHandler struct {
	svc *ReceiverSrv
}

func NewReceiversApi(svc *ReceiverSrv) *ReceiversApiHandler {
	return &ReceiversApiHandler{
		svc: svc,
	}
}

func (f *ReceiversApiHandler) handleRouteGetReceiver(ctx *contextmodel.ReqContext, name string) response.Response {
	return f.svc.RouteGetReceiver(ctx, name)
}

func (f *ReceiversApiHandler) handleRouteGetReceivers(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteGetReceivers(ctx)
}
