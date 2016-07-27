package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type ResultHandler interface {
	Handle(result *EvalContext)
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

func (handler *DefaultResultHandler) Handle(result *EvalContext) {
	var newState m.AlertStateType

	if result.Error != nil {
		handler.log.Error("Alert Rule Result Error", "ruleId", result.Rule.Id, "error", result.Error)
		newState = m.AlertStatePending
	} else if result.Firing {
		newState = m.AlertStateFiring
	} else {
		newState = m.AlertStateOK
	}

	if result.Rule.State != newState {
		handler.log.Info("New state change", "alertId", result.Rule.Id, "newState", newState, "oldState", result.Rule.State)

		cmd := &m.SetAlertStateCommand{
			AlertId: result.Rule.Id,
			OrgId:   result.Rule.OrgId,
			State:   newState,
		}

		if err := bus.Dispatch(cmd); err != nil {
			handler.log.Error("Failed to save state", "error", err)
		}

		result.Rule.State = newState
		handler.notifier.Notify(result)
	}
}
