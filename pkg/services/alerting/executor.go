package alerting

import (
	"fmt"

	"math"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	"github.com/grafana/grafana/pkg/tsdb"
)

type Executor interface {
	Execute(rule *AlertJob, responseQueue chan *AlertResult)
}

var (
	resultLogFmt   = "%s executor: %s  %1.2f %s %1.2f : %v"
	descriptionFmt = "Actual value: %1.2f for %s"
)

type ExecutorImpl struct{}

type compareFn func(float64, float64) bool
type aggregationFn func(*tsdb.TimeSeries) float64

var operators = map[string]compareFn{
	">":  func(num1, num2 float64) bool { return num1 > num2 },
	">=": func(num1, num2 float64) bool { return num1 >= num2 },
	"<":  func(num1, num2 float64) bool { return num1 < num2 },
	"<=": func(num1, num2 float64) bool { return num1 <= num2 },
	"":   func(num1, num2 float64) bool { return false },
}
var aggregator = map[string]aggregationFn{
	"avg": func(series *tsdb.TimeSeries) float64 {
		sum := float64(0)

		for _, v := range series.Points {
			sum += v[0]
		}

		return sum / float64(len(series.Points))
	},
	"sum": func(series *tsdb.TimeSeries) float64 {
		sum := float64(0)

		for _, v := range series.Points {
			sum += v[0]
		}

		return sum
	},
	"min": func(series *tsdb.TimeSeries) float64 {
		min := series.Points[0][0]

		for _, v := range series.Points {
			if v[0] < min {
				min = v[0]
			}
		}

		return min
	},
	"max": func(series *tsdb.TimeSeries) float64 {
		max := series.Points[0][0]

		for _, v := range series.Points {
			if v[0] > max {
				max = v[0]
			}
		}

		return max
	},
	"mean": func(series *tsdb.TimeSeries) float64 {
		midPosition := int64(math.Floor(float64(len(series.Points)) / float64(2)))
		return series.Points[midPosition][0]
	},
}

func (executor *ExecutorImpl) Execute(job *AlertJob, responseQueue chan *AlertResult) {
	response, err := executor.GetSeries(job)

	if err != nil {
		responseQueue <- &AlertResult{State: alertstates.Pending, Id: job.Rule.Id, AlertJob: job}
	}

	result := executor.validateRule(job.Rule, response)
	result.AlertJob = job
	responseQueue <- result
}

func (executor *ExecutorImpl) GetSeries(job *AlertJob) (tsdb.TimeSeriesSlice, error) {
	query := &m.GetDataSourceByIdQuery{
		Id:    job.Rule.DatasourceId,
		OrgId: job.Rule.OrgId,
	}

	err := bus.Dispatch(query)

	if err != nil {
		return nil, fmt.Errorf("Could not find datasource for %d", job.Rule.DatasourceId)
	}

	// if query.Result.Type == m.DS_GRAPHITE {
	// 	return GraphiteClient{}.GetSeries(*job, query.Result)
	// }

	return nil, fmt.Errorf("Grafana does not support alerts for %s", query.Result.Type)
}

func (executor *ExecutorImpl) validateRule(rule AlertRule, series tsdb.TimeSeriesSlice) *AlertResult {
	for _, serie := range series {
		if aggregator[rule.Aggregator] == nil {
			continue
		}

		var aggValue = aggregator[rule.Aggregator](serie)
		var critOperartor = operators[rule.CritOperator]
		var critResult = critOperartor(aggValue, rule.CritLevel)

		log.Trace(resultLogFmt, "Crit", serie.Name, aggValue, rule.CritOperator, rule.CritLevel, critResult)
		if critResult {
			return &AlertResult{
				State:       alertstates.Critical,
				Id:          rule.Id,
				ActualValue: aggValue,
				Description: fmt.Sprintf(descriptionFmt, aggValue, serie.Name),
			}
		}

		var warnOperartor = operators[rule.CritOperator]
		var warnResult = warnOperartor(aggValue, rule.CritLevel)
		log.Trace(resultLogFmt, "Warn", serie.Name, aggValue, rule.WarnOperator, rule.WarnLevel, warnResult)
		if warnResult {
			return &AlertResult{
				State:       alertstates.Warn,
				Id:          rule.Id,
				Description: fmt.Sprintf(descriptionFmt, aggValue, serie.Name),
				ActualValue: aggValue,
			}
		}
	}

	return &AlertResult{State: alertstates.Ok, Id: rule.Id, Description: "Alert is OK!"}
}
