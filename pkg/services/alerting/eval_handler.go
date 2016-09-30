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
	for _, condition := range context.Rule.Conditions {
		condition.Eval(context)

		// break if condition could not be evaluated
		if context.Error != nil {
			break
		}

		// break if result has not triggered yet
		if context.Firing == false {
			break
		}
	}

	context.EndTime = time.Now()
	elapsedTime := context.EndTime.Sub(context.StartTime) / time.Millisecond
	metrics.M_Alerting_Exeuction_Time.Update(elapsedTime)
}
