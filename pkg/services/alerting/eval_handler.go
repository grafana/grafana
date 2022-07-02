package alerting

import (
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// DefaultEvalHandler is responsible for evaluating the alert rule.
type DefaultEvalHandler struct {
	log             log.Logger
	alertJobTimeout time.Duration
	requestHandler  legacydata.RequestHandler
}

// NewEvalHandler is the `DefaultEvalHandler` constructor.
func NewEvalHandler(requestHandler legacydata.RequestHandler) *DefaultEvalHandler {
	return &DefaultEvalHandler{
		log:             log.New("alerting.evalHandler"),
		alertJobTimeout: time.Second * 5,
		requestHandler:  requestHandler,
	}
}

// Eval evaluated the alert rule.
func (e *DefaultEvalHandler) Eval(context *EvalContext) {
	firing := true
	noDataFound := true
	conditionEvals := ""

	for i := 0; i < len(context.Rule.Conditions); i++ {
		condition := context.Rule.Conditions[i]
		cr, err := condition.Eval(context, e.requestHandler)
		if err != nil {
			context.Error = err
		}

		// break if condition could not be evaluated
		if context.Error != nil {
			break
		}

		if i == 0 {
			firing = cr.Firing
			noDataFound = cr.NoDataFound
		}

		// calculating Firing based on operator
		if cr.Operator == "or" {
			firing = firing || cr.Firing
		} else {
			firing = firing && cr.Firing
		}

		// We cannot evaluate the expression when one or more conditions are missing data
		// and so noDataFound should be true if at least one condition returns no data,
		// irrespective of the operator.
		noDataFound = noDataFound || cr.NoDataFound

		if i > 0 {
			conditionEvals = "[" + conditionEvals + " " + strings.ToUpper(cr.Operator) + " " + strconv.FormatBool(cr.Firing) + "]"
		} else {
			conditionEvals = strconv.FormatBool(firing)
		}

		context.EvalMatches = append(context.EvalMatches, cr.EvalMatches...)
		context.AllMatches = append(context.AllMatches, cr.AllMatches...)
	}

	context.ConditionEvals = conditionEvals + " = " + strconv.FormatBool(firing)
	context.Firing = firing
	context.NoDataFound = noDataFound
	context.EndTime = time.Now()

	elapsedTime := context.EndTime.Sub(context.StartTime).Nanoseconds() / int64(time.Millisecond)
	metrics.MAlertingExecutionTime.Observe(float64(elapsedTime))
}
