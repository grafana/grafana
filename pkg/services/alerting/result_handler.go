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

func (handler *DefaultResultHandler) GetStateFromEvaluation(evalContext *EvalContext) m.AlertStateType {
	if evalContext.Error != nil {
		handler.log.Error("Alert Rule Result Error",
			"ruleId", evalContext.Rule.Id,
			"name", evalContext.Rule.Name,
			"error", evalContext.Error,
			"changing state to", evalContext.Rule.ExecutionErrorState.ToAlertState())

		if evalContext.Rule.ExecutionErrorState == m.ExecutionErrorKeepState {
			return evalContext.PrevAlertState
		} else {
			return evalContext.Rule.ExecutionErrorState.ToAlertState()
		}
	} else if evalContext.Firing {
		return m.AlertStateAlerting
	} else if evalContext.NoDataFound {
		handler.log.Info("Alert Rule returned no data",
			"ruleId", evalContext.Rule.Id,
			"name", evalContext.Rule.Name,
			"changing state to", evalContext.Rule.NoDataState.ToAlertState())

		if evalContext.Rule.NoDataState == m.NoDataKeepState {
			return evalContext.PrevAlertState
		} else {
			return evalContext.Rule.NoDataState.ToAlertState()
		}
	}

	return m.AlertStateOK
}

func (handler *DefaultResultHandler) Handle(evalContext *EvalContext) error {
	executionError := ""
	annotationData := simplejson.New()

	evalContext.Rule.State = handler.GetStateFromEvaluation(evalContext)

	if evalContext.Error != nil {
		executionError = evalContext.Error.Error()
		annotationData.Set("errorMessage", executionError)
	}

	if evalContext.Firing {
		annotationData = simplejson.NewFromAny(evalContext.EvalMatches)
	}

	countStateResult(evalContext.Rule.State)
	if evalContext.ShouldUpdateAlertState() {
		handler.log.Info("New state change", "alertId", evalContext.Rule.Id, "newState", evalContext.Rule.State, "prev state", evalContext.PrevAlertState)

		cmd := &m.SetAlertStateCommand{
			AlertId:  evalContext.Rule.Id,
			OrgId:    evalContext.Rule.OrgId,
			State:    evalContext.Rule.State,
			Error:    executionError,
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
			PrevState:   string(evalContext.PrevAlertState),
			Epoch:       time.Now().Unix(),
			Data:        annotationData,
		}

		annotationRepo := annotations.GetRepository()
		if err := annotationRepo.Save(&item); err != nil {
			handler.log.Error("Failed to save annotation for new alert state", "error", err)
		}

		if evalContext.ShouldSendNotification() {
			handler.notifier.Notify(evalContext)
		}
	}

	return nil
}

func countStateResult(state m.AlertStateType) {
	switch state {
	case m.AlertStatePending:
		metrics.M_Alerting_Result_State_Pending.Inc(1)
	case m.AlertStateAlerting:
		metrics.M_Alerting_Result_State_Alerting.Inc(1)
	case m.AlertStateOK:
		metrics.M_Alerting_Result_State_Ok.Inc(1)
	case m.AlertStatePaused:
		metrics.M_Alerting_Result_State_Paused.Inc(1)
	case m.AlertStateNoData:
		metrics.M_Alerting_Result_State_NoData.Inc(1)
	}
}
