package alerting

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/rendering"
)

type resultHandler interface {
	handle(evalContext *EvalContext) error
}

type defaultResultHandler struct {
	notifier *notificationService
	sqlStore AlertStore
	log      log.Logger
}

func newResultHandler(renderService rendering.Service, sqlStore AlertStore, notificationService *notifications.NotificationService, decryptFn GetDecryptedValueFn) *defaultResultHandler {
	return &defaultResultHandler{
		log:      log.New("alerting.resultHandler"),
		sqlStore: sqlStore,
		notifier: newNotificationService(renderService, sqlStore, notificationService, decryptFn),
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

	metrics.MAlertingResultState.WithLabelValues(string(evalContext.Rule.State)).Inc()
	if evalContext.shouldUpdateAlertState() {
		handler.log.Info("New state change", "ruleId", evalContext.Rule.ID, "newState", evalContext.Rule.State, "prev state", evalContext.PrevAlertState)

		cmd := &models.SetAlertStateCommand{
			AlertID:  evalContext.Rule.ID,
			OrgID:    evalContext.Rule.OrgID,
			State:    evalContext.Rule.State,
			Error:    executionError,
			EvalData: annotationData,
		}

		alert, err := handler.sqlStore.SetAlertState(evalContext.Ctx, cmd)
		if err != nil {
			if errors.Is(err, models.ErrCannotChangeStateOnPausedAlert) {
				handler.log.Error("Cannot change state on alert that's paused", "error", err)
				return err
			}

			if errors.Is(err, models.ErrRequiresNewState) {
				handler.log.Info("Alert already updated")
				return nil
			}

			handler.log.Error("Failed to save state", "error", err)
		} else {
			// StateChanges is used for de duping alert notifications
			// when two servers are raising. This makes sure that the server
			// with the last state change always sends a notification.
			evalContext.Rule.StateChanges = alert.StateChanges

			// Update the last state change of the alert rule in memory
			evalContext.Rule.LastStateChange = time.Now()
		}

		// save annotation
		item := annotations.Item{
			OrgID:       evalContext.Rule.OrgID,
			DashboardID: evalContext.Rule.DashboardID,
			PanelID:     evalContext.Rule.PanelID,
			AlertID:     evalContext.Rule.ID,
			Text:        "",
			NewState:    string(evalContext.Rule.State),
			PrevState:   string(evalContext.PrevAlertState),
			Epoch:       time.Now().UnixNano() / int64(time.Millisecond),
			Data:        annotationData,
		}

		if err := evalContext.annotationRepo.Save(evalContext.Ctx, &item); err != nil {
			handler.log.Error("Failed to save annotation for new alert state", "error", err)
		}
	}

	if err := handler.notifier.SendIfNeeded(evalContext); err != nil {
		switch {
		case errors.Is(err, context.Canceled):
			handler.log.Debug("handler.notifier.SendIfNeeded returned context.Canceled")
		case errors.Is(err, context.DeadlineExceeded):
			handler.log.Debug("handler.notifier.SendIfNeeded returned context.DeadlineExceeded")
		default:
			handler.log.Error("handler.notifier.SendIfNeeded failed", "err", err)
		}
	}

	return nil
}
