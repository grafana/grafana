package alerting

import (
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
	for _, condition := range context.Rule.Conditions {
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
		} else {
			firing = firing && cr.Firing
		}

		context.EvalMatches = append(context.EvalMatches, cr.EvalMatches...)
	}

	context.Firing = firing
	context.EndTime = time.Now()
	elapsedTime := context.EndTime.Sub(context.StartTime) / time.Millisecond
	metrics.M_Alerting_Exeuction_Time.Update(elapsedTime)
}
