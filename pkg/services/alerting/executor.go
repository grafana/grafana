package alerting

import (
	"fmt"

	"math"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	b "github.com/grafana/grafana/pkg/services/alerting/datasources"
)

type Executor interface {
	Execute(rule *m.AlertJob, responseQueue chan *m.AlertResult)
}

var (
	ResultLogFmt = "%s executor: %s  %1.2f %s %1.2f : %v"
)

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
	"avg": func(series *m.TimeSeries) float64 {
		sum := float64(0)

		for _, v := range series.Points {
			sum += v[0]
		}

		return sum / float64(len(series.Points))
	},
	"sum": func(series *m.TimeSeries) float64 {
		sum := float64(0)

		for _, v := range series.Points {
			sum += v[0]
		}

		return sum
	},
	"min": func(series *m.TimeSeries) float64 {
		min := series.Points[0][0]

		for _, v := range series.Points {
			if v[0] < min {
				min = v[0]
			}
		}

		return min
	},
	"max": func(series *m.TimeSeries) float64 {
		max := series.Points[0][0]

		for _, v := range series.Points {
			if v[0] > max {
				max = v[0]
			}
		}

		return max
	},
	"mean": func(series *m.TimeSeries) float64 {
		midPosition := int64(math.Floor(float64(len(series.Points)) / float64(2)))
		return series.Points[midPosition][0]
	},
}

func (this *ExecutorImpl) Execute(job *m.AlertJob, responseQueue chan *m.AlertResult) {
	response, err := b.GetSeries(job)

	if err != nil {
		responseQueue <- &m.AlertResult{State: m.AlertStatePending, Id: job.Rule.Id, AlertJob: job}
	}

	result := this.validateRule(job.Rule, response)
	result.AlertJob = job
	responseQueue <- result
}

func (this *ExecutorImpl) validateRule(rule m.AlertRule, series m.TimeSeriesSlice) *m.AlertResult {
	for _, serie := range series {
		if aggregator[rule.Aggregator] == nil {
			continue
		}

		var aggValue = aggregator[rule.Aggregator](serie)
		var critOperartor = operators[rule.CritOperator]
		var critResult = critOperartor(aggValue, rule.CritLevel)

		log.Debug(ResultLogFmt, "Crit", serie.Name, aggValue, rule.CritOperator, rule.CritLevel, critResult)
		if critResult {
			return &m.AlertResult{
				State:       m.AlertStateCritical,
				Id:          rule.Id,
				ActualValue: aggValue,
				Description: fmt.Sprintf("Actual value: %1.2f for %s", aggValue, serie.Name),
			}
		}

		var warnOperartor = operators[rule.CritOperator]
		var warnResult = warnOperartor(aggValue, rule.CritLevel)
		log.Debug(ResultLogFmt, "Warn", serie.Name, aggValue, rule.WarnOperator, rule.WarnLevel, warnResult)
		if warnResult {
			return &m.AlertResult{
				State:       m.AlertStateWarn,
				Id:          rule.Id,
				Description: fmt.Sprintf("Actual value: %1.2f for %s", aggValue, serie.Name),
				ActualValue: aggValue,
			}
		}
	}

	return &m.AlertResult{State: m.AlertStateOk, Id: rule.Id, Description: "Alert is OK!"}
}
