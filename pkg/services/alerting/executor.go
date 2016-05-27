package alerting

import (
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/graphite"
)

type Executor interface {
	Execute(rule m.AlertRule, responseQueue chan *AlertResult)
}

type ExecutorImpl struct{}

type fn func(float64, float64) bool

var operators map[string]fn = map[string]fn{
	">":  func(num1, num2 float64) bool { return num1 > num2 },
	">=": func(num1, num2 float64) bool { return num1 >= num2 },
	"<":  func(num1, num2 float64) bool { return num1 < num2 },
	"<=": func(num1, num2 float64) bool { return num1 <= num2 },
}

func (this *ExecutorImpl) Execute(rule m.AlertRule, responseQueue chan *AlertResult) {
	response, err := graphite.GraphiteClient{}.GetSeries(rule)

	if err != nil {
		responseQueue <- &AlertResult{State: "CRITICAL", Id: rule.Id}
	}

	responseQueue <- this.ValidateRule(rule, response)
}

func (this *ExecutorImpl) ValidateRule(rule m.AlertRule, series m.TimeSeriesSlice) *AlertResult {
	for _, v := range series {
		var avg float64
		var sum float64
		for _, dp := range v.Points {
			sum += dp[0]
		}

		avg = sum / float64(len(v.Points))

		if rule.CritOperator != "" && operators[rule.CritOperator](float64(rule.CritLevel), avg) {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: avg}
		}

		if rule.WarnOperator != "" && operators[rule.WarnOperator](float64(rule.WarnLevel), avg) {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: avg}
		}

		if rule.CritOperator != "" && operators[rule.CritOperator](float64(rule.CritLevel), sum) {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: sum}
		}

		if rule.WarnOperator != "" && operators[rule.WarnOperator](float64(rule.WarnLevel), sum) {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: sum}
		}
	}

	return &AlertResult{State: m.AlertStateOk, Id: rule.Id}
}
