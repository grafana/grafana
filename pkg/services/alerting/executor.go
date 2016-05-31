package alerting

import (
	"fmt"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/graphite"
)

type Executor interface {
	Execute(rule *m.AlertJob, responseQueue chan *m.AlertResult)
}

type ExecutorImpl struct{}

type compareFn func(float64, float64) bool
type aggregationFn func(*m.TimeSeries) float64

var operators map[string]compareFn = map[string]compareFn{
	">":  func(num1, num2 float64) bool { return num1 > num2 },
	">=": func(num1, num2 float64) bool { return num1 >= num2 },
	"<":  func(num1, num2 float64) bool { return num1 < num2 },
	"<=": func(num1, num2 float64) bool { return num1 <= num2 },
	"":   func(num1, num2 float64) bool { return false },
}

var aggregator map[string]aggregationFn = map[string]aggregationFn{
	"avg":  func(series *m.TimeSeries) float64 { return series.Avg },
	"sum":  func(series *m.TimeSeries) float64 { return series.Sum },
	"min":  func(series *m.TimeSeries) float64 { return series.Min },
	"max":  func(series *m.TimeSeries) float64 { return series.Max },
	"mean": func(series *m.TimeSeries) float64 { return series.Mean },
}

func (this *ExecutorImpl) GetSeries(job *m.AlertJob) (m.TimeSeriesSlice, error) {
	if job.Datasource.Type == m.DS_GRAPHITE {
		return graphite.GraphiteClient{}.GetSeries(job)
	}

	return nil, fmt.Errorf("Grafana does not support alerts for %s", job.Datasource.Type)
}

func (this *ExecutorImpl) Execute(job *m.AlertJob, responseQueue chan *m.AlertResult) {
	response, err := this.GetSeries(job)

	if err != nil {
		responseQueue <- &m.AlertResult{State: "PENDING", Id: job.Rule.Id, Rule: job.Rule}
	}

	responseQueue <- this.ValidateRule(job.Rule, response)
}

func (this *ExecutorImpl) ValidateRule(rule m.AlertRule, series m.TimeSeriesSlice) *m.AlertResult {
	for _, serie := range series {
		if aggregator[rule.Aggregator] == nil {
			continue
		}

		var aggValue = aggregator[rule.Aggregator](serie)

		if operators[rule.CritOperator](aggValue, rule.CritLevel) {
			return &m.AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: aggValue, Rule: rule}
		}

		if operators[rule.WarnOperator](aggValue, rule.WarnLevel) {
			return &m.AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: aggValue, Rule: rule}
		}
	}

	return &m.AlertResult{State: m.AlertStateOk, Id: rule.Id, Rule: rule}
}
