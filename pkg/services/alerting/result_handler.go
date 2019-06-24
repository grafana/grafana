package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/rendering"
)

type resultHandler interface {
	handle(evalContext *EvalContext) error
}

type defaultResultHandler struct {
	notifier *notificationService
	log      log.Logger
}

func newResultHandler(renderService rendering.Service) *defaultResultHandler {
	return &defaultResultHandler{
		log:      log.New("alerting.resultHandler"),
		notifier: newNotificationService(renderService),
	}
}

func (handler *defaultResultHandler) handle(evalContext *EvalContext) error {
	executionError := ""
	annotationData := simplejson.New()

	if len(evalContext.EvalMatches) > 0 {
		annotationData.Set("evalMatches", simplejson.NewFromAny(evalContext.EvalMatches))
	}

	if evalContext.Error != nil {
		executionError = evalContext.Error.Error()
		annotationData.Set("error", executionError)
	} else if evalContext.NoDataFound {
		annotationData.Set("noData", true)
	}

	metrics.M_Alerting_Result_State.WithLabelValues(string(evalContext.Rule.State)).Inc()
	if evalContext.shouldUpdateAlertState() {
		handler.log.Info("New state change", "alertId", evalContext.Rule.ID, "newState", evalContext.Rule.State, "prev state", evalContext.PrevAlertState)

		cmd := &models.SetAlertStateCommand{
			AlertId:  evalContext.Rule.ID,
			OrgId:    evalContext.Rule.OrgID,
			State:    evalContext.Rule.State,
			Error:    executionError,
			EvalData: annotationData,
		}

		if err := bus.Dispatch(cmd); err != nil {
			if err == models.ErrCannotChangeStateOnPausedAlert {
				handler.log.Error("Cannot change state on alert that's paused", "error", err)
				return err
			}

			if err == models.ErrRequiresNewState {
				handler.log.Info("Alert already updated")
				return nil
			}

			handler.log.Error("Failed to save state", "error", err)
		} else {

			// StateChanges is used for de duping alert notifications
			// when two servers are raising. This makes sure that the server
			// with the last state change always sends a notification.
			evalContext.Rule.StateChanges = cmd.Result.StateChanges

			// Update the last state change of the alert rule in memory
			evalContext.Rule.LastStateChange = time.Now()
		}

		// save annotation
		item := annotations.Item{
			OrgId:       evalContext.Rule.OrgID,
			DashboardId: evalContext.Rule.DashboardID,
			PanelId:     evalContext.Rule.PanelID,
			AlertId:     evalContext.Rule.ID,
			Text:        "",
			NewState:    string(evalContext.Rule.State),
			PrevState:   string(evalContext.PrevAlertState),
			Epoch:       time.Now().UnixNano() / int64(time.Millisecond),
			Data:        annotationData,
		}

		annotationRepo := annotations.GetRepository()
		if err := annotationRepo.Save(&item); err != nil {
			handler.log.Error("Failed to save annotation for new alert state", "error", err)
		}
	}

	handler.notifier.SendIfNeeded(evalContext)
	return nil
}
