package alerting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
)

var (
	MaxRetries int = 1
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
	go e.eval(context)

	select {
	case <-time.After(e.alertJobTimeout):
		context.Error = fmt.Errorf("Timeout")
		context.EndTime = time.Now()
		e.log.Debug("Job Execution timeout", "alertId", context.Rule.Id)
		e.retry(context)
	case <-context.DoneChan:
		e.log.Debug("Job Execution done", "timeMs", context.GetDurationMs(), "alertId", context.Rule.Id, "firing", context.Firing)

		if context.Error != nil {
			e.retry(context)
		}
	}
}

func (e *DefaultEvalHandler) retry(context *EvalContext) {
	e.log.Debug("Retrying eval exeuction", "alertId", context.Rule.Id)

	context.RetryCount++
	if context.RetryCount > MaxRetries {
		context.DoneChan = make(chan bool, 1)
		context.CancelChan = make(chan bool, 1)
		e.Eval(context)
	}
}

func (e *DefaultEvalHandler) eval(context *EvalContext) {
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
	elapsedTime := context.EndTime.Sub(context.StartTime)
	metrics.M_Alerting_Exeuction_Time.Update(elapsedTime)
	context.DoneChan <- true
}
