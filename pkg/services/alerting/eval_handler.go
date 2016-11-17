package alerting

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
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
	firingEval := ""
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
		operator := "AND"
		if cr.Operator == "or" {
			firing = firing || cr.Firing
			operator = "OR"
		} else {
			firing = firing && cr.Firing
		}

		if i > 0 {
			firingEval = "[" + firingEval + " " + operator + " " + strconv.FormatBool(cr.Firing) + "]"
		} else {
			firingEval = "[" + strconv.FormatBool(firing) + "]"
		}

		context.EvalMatches = append(context.EvalMatches, cr.EvalMatches...)
	}

	context.FiringEval = firingEval + " = " + strconv.FormatBool(firing)
	context.Firing = firing
	context.EndTime = time.Now()
	elapsedTime := context.EndTime.Sub(context.StartTime) / time.Millisecond
	metrics.M_Alerting_Exeuction_Time.Update(elapsedTime)
}
