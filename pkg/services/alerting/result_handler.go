package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type ResultHandler interface {
	Handle(result *AlertResult)
}

type ResultHandlerImpl struct {
	notifier Notifier
	log      log.Logger
}

func NewResultHandler() *ResultHandlerImpl {
	return &ResultHandlerImpl{
		log:      log.New("alerting.responseHandler"),
		notifier: NewNotifier(),
	}
}

func (handler *ResultHandlerImpl) Handle(result *AlertResult) {
	if handler.shouldUpdateState(result) {
		cmd := &m.UpdateAlertStateCommand{
			AlertId:         result.AlertJob.Rule.Id,
			NewState:        result.State,
			Info:            result.Description,
			OrgId:           result.AlertJob.Rule.OrgId,
			TriggeredAlerts: simplejson.NewFromAny(result.TriggeredAlerts),
		}

		if err := bus.Dispatch(cmd); err != nil {
			handler.log.Error("Failed to save state", "error", err)
		}

		handler.log.Debug("will notify about new state", "new state", result.State)
		handler.notifier.Notify(result)
	}
}

func (handler *ResultHandlerImpl) shouldUpdateState(result *AlertResult) bool {
	query := &m.GetLastAlertStateQuery{
		AlertId: result.AlertJob.Rule.Id,
		OrgId:   result.AlertJob.Rule.OrgId,
	}

	if err := bus.Dispatch(query); err != nil {
		log.Error2("Failed to read last alert state", "error", err)
		return false
	}

	if query.Result == nil {
		return true
	}

	lastExecution := query.Result.Created
	asdf := result.ExeuctionTime.Add(time.Minute * -15)
	olderThen15Min := lastExecution.Before(asdf)
	changedState := query.Result.NewState != result.State

	return changedState || olderThen15Min
}
