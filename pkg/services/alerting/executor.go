package alerting

import (
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/graphite"
)

type Executor interface {
	Execute(rule m.AlertRule, responseQueue chan *AlertResult)
}

type ExecutorImpl struct{}

type compareFn func(float64, float64) bool
type aggregationFn func(*m.TimeSeries) float64

var operators map[string]compareFn = map[string]compareFn{
	">":  func(num1, num2 float64) bool { return num1 > num2 },
	">=": func(num1, num2 float64) bool { return num1 >= num2 },
	"<":  func(num1, num2 float64) bool { return num1 < num2 },
	"<=": func(num1, num2 float64) bool { return num1 <= num2 },
}

var aggregator map[string]aggregationFn = map[string]aggregationFn{
	"avg":  func(series *m.TimeSeries) float64 { return series.Avg },
	"sum":  func(series *m.TimeSeries) float64 { return series.Sum },
	"min":  func(series *m.TimeSeries) float64 { return series.Min },
	"max":  func(series *m.TimeSeries) float64 { return series.Max },
	"mean": func(series *m.TimeSeries) float64 { return series.Mean },
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
		var aggValue = aggregator[rule.Aggregator](v)

		if rule.CritOperator != "" && operators[rule.CritOperator](float64(rule.CritLevel), aggValue) {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: aggValue}
		}

		if rule.WarnOperator != "" && operators[rule.WarnOperator](float64(rule.WarnLevel), aggValue) {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: aggValue}
		}
	}

	return &AlertResult{State: m.AlertStateOk, Id: rule.Id}
}
