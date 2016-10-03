package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
)

type ResultHandler interface {
	Handle(evalContext *EvalContext) error
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

func (handler *DefaultResultHandler) Handle(evalContext *EvalContext) error {
	oldState := evalContext.Rule.State

	exeuctionError := ""
	annotationData := simplejson.New()
	if evalContext.Error != nil {
		handler.log.Error("Alert Rule Result Error", "ruleId", evalContext.Rule.Id, "error", evalContext.Error)
		evalContext.Rule.State = m.AlertStateExecError
		exeuctionError = evalContext.Error.Error()
		annotationData.Set("errorMessage", exeuctionError)
	} else if evalContext.Firing {
		evalContext.Rule.State = m.AlertStateAlerting
		annotationData = simplejson.NewFromAny(evalContext.EvalMatches)
	} else {
		// handle no data case
		if evalContext.NoDataFound {
			evalContext.Rule.State = evalContext.Rule.NoDataState
		} else {
			evalContext.Rule.State = m.AlertStateOK
		}
	}

	countStateResult(evalContext.Rule.State)
	if evalContext.Rule.State != oldState {
		handler.log.Info("New state change", "alertId", evalContext.Rule.Id, "newState", evalContext.Rule.State, "oldState", oldState)

		cmd := &m.SetAlertStateCommand{
			AlertId:  evalContext.Rule.Id,
			OrgId:    evalContext.Rule.OrgId,
			State:    evalContext.Rule.State,
			Error:    exeuctionError,
			EvalData: annotationData,
		}

		if err := bus.Dispatch(cmd); err != nil {
			handler.log.Error("Failed to save state", "error", err)
		}

		// save annotation
		item := annotations.Item{
			OrgId:       evalContext.Rule.OrgId,
			DashboardId: evalContext.Rule.DashboardId,
			PanelId:     evalContext.Rule.PanelId,
			Type:        annotations.AlertType,
			AlertId:     evalContext.Rule.Id,
			Title:       evalContext.Rule.Name,
			Text:        evalContext.GetStateModel().Text,
			NewState:    string(evalContext.Rule.State),
			PrevState:   string(oldState),
			Epoch:       time.Now().Unix(),
			Data:        annotationData,
		}

		annotationRepo := annotations.GetRepository()
		if err := annotationRepo.Save(&item); err != nil {
			handler.log.Error("Failed to save annotation for new alert state", "error", err)
		}

		handler.notifier.Notify(evalContext)
	}

	return nil
}

func countStateResult(state m.AlertStateType) {
	switch state {
	case m.AlertStateAlerting:
		metrics.M_Alerting_Result_State_Alerting.Inc(1)
	case m.AlertStateOK:
		metrics.M_Alerting_Result_State_Ok.Inc(1)
	case m.AlertStatePaused:
		metrics.M_Alerting_Result_State_Paused.Inc(1)
	case m.AlertStateNoData:
		metrics.M_Alerting_Result_State_NoData.Inc(1)
	case m.AlertStateExecError:
		metrics.M_Alerting_Result_State_ExecError.Inc(1)
	}
}
