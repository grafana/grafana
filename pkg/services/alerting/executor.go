package alerting

import (
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/graphite"
)

type Executor interface {
	Execute(rule m.AlertRule, responseQueue chan *AlertResult)
}

type ExecutorImpl struct{}

func (this *ExecutorImpl) Execute(rule m.AlertRule, responseQueue chan *AlertResult) {
	response, err := graphite.GraphiteClient{}.GetSeries(rule)

	if err != nil {
		responseQueue <- &AlertResult{State: "CRITICAL", Id: rule.Id}
	}

	responseQueue <- this.executeRules(response, rule)
}

func (this *ExecutorImpl) executeRules(series m.TimeSeriesSlice, rule m.AlertRule) *AlertResult {
	for _, v := range series {
		var avg float64
		var sum float64
		for _, dp := range v.Points {
			sum += dp[0]
		}

		avg = sum / float64(len(v.Points))

		if float64(rule.CritLevel) < avg {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: avg}
		}

		if float64(rule.WarnLevel) < avg {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: avg}
		}

		if float64(rule.CritLevel) < sum {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: sum}
		}

		if float64(rule.WarnLevel) < sum {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: sum}
		}
	}

	return &AlertResult{State: m.AlertStateOk, Id: rule.Id}
}
