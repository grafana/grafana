package alerting

import (
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/models"
)

type DefaultEvalHandler struct {
	log             log.Logger
	alertJobTimeout time.Duration
}

func NewEvalHandler() *DefaultEvalHandler {
	return &DefaultEvalHandler{
		log:             log.New("alerting.evalHandler"),
		alertJobTimeout: time.Second * 5,
	}
}

func (e *DefaultEvalHandler) Eval(context *EvalContext) {
	firing := true
	noDataFound := true
	conditionEvals := ""

	for i := 0; i < len(context.Rule.Conditions); i++ {
		condition := context.Rule.Conditions[i]
		cr, err := condition.Eval(context)
		if err != nil {
			context.Error = err
		}

		// break if condition could not be evaluated
		if context.Error != nil {
			break
		}

		// calculating Firing based on operator
		if cr.Operator == "or" {
			firing = firing || cr.Firing
			noDataFound = noDataFound || cr.NoDataFound
		} else {
			firing = firing && cr.Firing
			noDataFound = noDataFound && cr.NoDataFound
		}

		if i > 0 {
			conditionEvals = "[" + conditionEvals + " " + strings.ToUpper(cr.Operator) + " " + strconv.FormatBool(cr.Firing) + "]"
		} else {
			conditionEvals = strconv.FormatBool(firing)
		}

		context.EvalMatches = append(context.EvalMatches, cr.EvalMatches...)
	}

	context.ConditionEvals = conditionEvals + " = " + strconv.FormatBool(firing)
	context.Firing = firing
	context.NoDataFound = noDataFound
	context.EndTime = time.Now()
	context.Rule.State = e.getNewState(context)

	elapsedTime := context.EndTime.Sub(context.StartTime).Nanoseconds() / int64(time.Millisecond)
	metrics.M_Alerting_Execution_Time.Observe(float64(elapsedTime))
}

// This should be move into evalContext once its been refactored.
func (handler *DefaultEvalHandler) getNewState(evalContext *EvalContext) models.AlertStateType {
	if evalContext.Error != nil {
		handler.log.Error("Alert Rule Result Error",
			"ruleId", evalContext.Rule.Id,
			"name", evalContext.Rule.Name,
			"error", evalContext.Error,
			"changing state to", evalContext.Rule.ExecutionErrorState.ToAlertState())

		if evalContext.Rule.ExecutionErrorState == models.ExecutionErrorKeepState {
			return evalContext.PrevAlertState
		} else {
			return evalContext.Rule.ExecutionErrorState.ToAlertState()
		}
	} else if evalContext.Firing {
		return models.AlertStateAlerting
	} else if evalContext.NoDataFound {
		handler.log.Info("Alert Rule returned no data",
			"ruleId", evalContext.Rule.Id,
			"name", evalContext.Rule.Name,
			"changing state to", evalContext.Rule.NoDataState.ToAlertState())

		if evalContext.Rule.NoDataState == models.NoDataKeepState {
			return evalContext.PrevAlertState
		} else {
			return evalContext.Rule.NoDataState.ToAlertState()
		}
	}

	return models.AlertStateOK
}
