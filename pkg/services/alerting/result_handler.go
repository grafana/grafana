package alerting

import "github.com/grafana/grafana/pkg/log"

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
	// if handler.shouldUpdateState(result) {
	// 	cmd := &m.UpdateAlertStateCommand{
	// 		AlertId:         result.Rule.Id,
	// 		State:           result.Rule.Severity,
	// 		Info:            result.Description,
	// 		OrgId:           result.Rule.OrgId,
	// 		TriggeredAlerts: simplejson.NewFromAny(result.Details),
	// 	}
	//
	// 	if err := bus.Dispatch(cmd); err != nil {
	// 		handler.log.Error("Failed to save state", "error", err)
	// 	}
	//
	// 	handler.log.Debug("will notify about new state", "new state", result.State)
	// 	handler.notifier.Notify(result)
	// }
}

func (handler *ResultHandlerImpl) shouldUpdateState(result *AlertResultContext) bool {
	// query := &m.GetLastAlertStateQuery{
	// 	AlertId: result.AlertJob.Rule.Id,
	// 	OrgId:   result.AlertJob.Rule.OrgId,
	// }
	//
	// if err := bus.Dispatch(query); err != nil {
	// 	log.Error2("Failed to read last alert state", "error", err)
	// 	return false
	// }
	//
	// if query.Result == nil {
	// 	return true
	// }
	//
	// lastExecution := query.Result.Created
	// asdf := result.StartTime.Add(time.Minute * -15)
	// olderThen15Min := lastExecution.Before(asdf)
	// changedState := query.Result.State != result.State
	//
	// return changedState || olderThen15Min
	return false
}
