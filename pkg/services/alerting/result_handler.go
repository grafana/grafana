package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
)

type ResultHandler interface {
	Handle(ctx *EvalContext)
}

type DefaultResultHandler struct {
	notifier Notifier
	log      log.Logger
}

func NewResultHandler() *DefaultResultHandler {
	return &DefaultResultHandler{
		log:      log.New("alerting.resultHandler"),
		notifier: NewRootNotifier(),
	}
}

func (handler *DefaultResultHandler) Handle(ctx *EvalContext) {
	oldState := ctx.Rule.State

	if ctx.Error != nil {
		handler.log.Error("Alert Rule Result Error", "ruleId", ctx.Rule.Id, "error", ctx.Error)
		ctx.Rule.State = m.AlertStatePending
	} else if ctx.Firing {
		ctx.Rule.State = m.AlertStateFiring
	} else {
		ctx.Rule.State = m.AlertStateOK
	}

	if ctx.Rule.State != oldState {
		handler.log.Info("New state change", "alertId", ctx.Rule.Id, "newState", ctx.Rule.State, "oldState", oldState)

		cmd := &m.SetAlertStateCommand{
			AlertId: ctx.Rule.Id,
			OrgId:   ctx.Rule.OrgId,
			State:   ctx.Rule.State,
		}

		if err := bus.Dispatch(cmd); err != nil {
			handler.log.Error("Failed to save state", "error", err)
		}

		// save annotation
		item := annotations.Item{
			OrgId:     ctx.Rule.OrgId,
			Type:      annotations.AlertType,
			AlertId:   ctx.Rule.Id,
			Title:     ctx.Rule.Name,
			Text:      ctx.GetStateText(),
			NewState:  string(ctx.Rule.State),
			PrevState: string(oldState),
			Timestamp: time.Now(),
		}
		annotationRepo := annotations.GetRepository()
		if err := annotationRepo.Save(&item); err != nil {
			handler.log.Error("Failed to save annotation for new alert state", "error", err)
		}

		handler.notifier.Notify(ctx)
	}
}
