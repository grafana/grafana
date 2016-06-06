package alerting

import (
	"fmt"
	"strconv"

	"math"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	resultLogFmt   = "Alerting: executor %s  %1.2f %s %1.2f : %v"
	descriptionFmt = "Actual value: %1.2f for %s"
)

type ExecutorImpl struct {
}

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

func (e *ExecutorImpl) Execute(job *AlertJob, resultQueue chan *AlertResult) {
	timeSeries, err := e.executeQuery(job)
	if err != nil {
		resultQueue <- &AlertResult{
			Error:    err,
			State:    alertstates.Pending,
			AlertJob: job,
		}
	}

	result := e.evaluateRule(job.Rule, timeSeries)
	result.AlertJob = job
	resultQueue <- result
}

func (e *ExecutorImpl) executeQuery(job *AlertJob) (tsdb.TimeSeriesSlice, error) {
	getDsInfo := &m.GetDataSourceByIdQuery{
		Id:    job.Rule.DatasourceId,
		OrgId: job.Rule.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource for %d", job.Rule.DatasourceId)
	}

	req := e.GetRequestForAlertRule(job.Rule, getDsInfo.Result)
	result := make(tsdb.TimeSeriesSlice, 0)

	resp, err := tsdb.HandleRequest(req)
	if err != nil {
		return nil, fmt.Errorf("Alerting: GetSeries() tsdb.HandleRequest() error %v", err)
	}

	for _, v := range resp.Results {
		if v.Error != nil {
			return nil, fmt.Errorf("Alerting: GetSeries() tsdb.HandleRequest() response error %v", v)
		}

		result = append(result, v.Series...)
	}

	return result, nil
}

func (e *ExecutorImpl) GetRequestForAlertRule(rule *AlertRule, datasource *m.DataSource) *tsdb.Request {

	req := &tsdb.Request{
		TimeRange: tsdb.TimeRange{
			From: "-" + strconv.Itoa(rule.QueryRange) + "s",
			To:   "now",
		},
		Queries: tsdb.QuerySlice{
			&tsdb.Query{
				RefId: rule.QueryRefId,
				Query: rule.Query,
				DataSource: &tsdb.DataSourceInfo{
					Id:       datasource.Id,
					Name:     datasource.Name,
					PluginId: datasource.Type,
					Url:      datasource.Url,
				},
			},
		},
	}

	return req
}

func (e *ExecutorImpl) evaluateRule(rule *AlertRule, series tsdb.TimeSeriesSlice) *AlertResult {
	log.Trace("Alerting: executor.evaluateRule: %v, query result: series: %v", rule.Name, len(series))

	for _, serie := range series {
		log.Info("Alerting: executor.validate: %v", serie.Name)

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
				Description: fmt.Sprintf(descriptionFmt, aggValue, serie.Name),
				ActualValue: aggValue,
			}
		}
	}

	return &AlertResult{State: alertstates.Ok, Description: "Alert is OK!"}
}
