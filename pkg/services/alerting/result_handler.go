package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type ResultHandler interface {
	Handle(result *AlertResultContext)
}

type ResultHandlerImpl struct {
	notifier Notifier
	log      log.Logger
}

func NewResultHandler() *ResultHandlerImpl {
	return &ResultHandlerImpl{
		log: log.New("alerting.resultHandler"),
	}
}

func (handler *ResultHandlerImpl) Handle(result *AlertResultContext) {
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
		//handler.log.Debug("will notify about new state", "new state", result.State)
		//handler.notifier.Notify(result)
	}
}
