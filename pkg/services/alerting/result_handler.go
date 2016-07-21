package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
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
		log: log.New("alerting.responseHandler"),
		//notifier: NewNotifier(),
	}
}

func (handler *ResultHandlerImpl) Handle(result *AlertResultContext) {
	newState := alertstates.Ok
	if result.Triggered {
		newState = result.Rule.Severity
	}

	handler.log.Info("Handle result", "newState", newState)
	handler.log.Info("Handle result", "triggered", result.Triggered)

	if handler.shouldUpdateState(result, newState) {
		cmd := &m.UpdateAlertStateCommand{
			AlertId:         result.Rule.Id,
			Info:            result.Description,
			OrgId:           result.Rule.OrgId,
			State:           newState,
			TriggeredAlerts: simplejson.NewFromAny(result.Details),
		}

		if err := bus.Dispatch(cmd); err != nil {
			handler.log.Error("Failed to save state", "error", err)
		}

		//handler.log.Debug("will notify about new state", "new state", result.State)
		//handler.notifier.Notify(result)
	}
}

func (handler *ResultHandlerImpl) shouldUpdateState(result *AlertResultContext, newState string) bool {
	query := &m.GetLastAlertStateQuery{
		AlertId: result.Rule.Id,
		OrgId:   result.Rule.OrgId,
	}

	if err := bus.Dispatch(query); err != nil {
		log.Error2("Failed to read last alert state", "error", err)
		return false
	}

	if query.Result == nil {
		return true
	}

	lastExecution := query.Result.Created
	asdf := result.StartTime.Add(time.Minute * -15)
	olderThen15Min := lastExecution.Before(asdf)
	changedState := query.Result.State != newState

	return changedState || olderThen15Min
}
