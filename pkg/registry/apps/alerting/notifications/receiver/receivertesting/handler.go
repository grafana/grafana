package receivertesting

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"

	_ "github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert"
)

type ReceiverTestingHandler struct {
	ng *ngalert.AlertNG
}

func New(ng *ngalert.AlertNG) *ReceiverTestingHandler {
	return &ReceiverTestingHandler{ng: ng}
}

func (p *ReceiverTestingHandler) HandleReceiverTestingRequest(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
	w.WriteHeader(444)
	return nil
}
