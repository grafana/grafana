package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	descriptionFmt = "Actual value: %1.2f for %s"
)

type ExecutorImpl struct {
	log log.Logger
}

func NewExecutor() *ExecutorImpl {
	return &ExecutorImpl{
		log: log.New("alerting.executor"),
	}
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
		Id:    job.Rule.Query.DatasourceId,
		OrgId: job.Rule.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource")
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
	e.log.Debug("GetRequest", "query", rule.Query.Query, "from", rule.Query.From, "datasourceId", datasource.Id)
	req := &tsdb.Request{
		TimeRange: tsdb.TimeRange{
			From: "-" + rule.Query.From,
			To:   rule.Query.To,
		},
		Queries: []*tsdb.Query{
			{
				RefId: "A",
				Query: rule.Query.Query,
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
	e.log.Debug("Evaluating Alerting Rule", "seriesCount", len(series), "ruleName", rule.Name)

	for _, serie := range series {
		e.log.Debug("Evaluating series", "series", serie.Name)
		transformedValue, _ := rule.Transformer.Transform(serie)

		critResult := evalCondition(rule.Critical, transformedValue)
		e.log.Debug("Alert execution Crit", "name", serie.Name, "transformedValue", transformedValue, "operator", rule.Critical.Operator, "level", rule.Critical.Level, "result", critResult)
		if critResult {
			return &AlertResult{
				State:       alertstates.Critical,
				ActualValue: transformedValue,
				Description: fmt.Sprintf(descriptionFmt, transformedValue, serie.Name),
			}
		}

		warnResult := evalCondition(rule.Warning, transformedValue)
		e.log.Debug("Alert execution Warn", "name", serie.Name, "transformedValue", transformedValue, "operator", rule.Warning.Operator, "level", rule.Warning.Level, "result", warnResult)
		if warnResult {
			return &AlertResult{
				State:       alertstates.Warn,
				Description: fmt.Sprintf(descriptionFmt, transformedValue, serie.Name),
				ActualValue: transformedValue,
			}
		}
	}

	return &AlertResult{State: alertstates.Ok, Description: "Alert is OK!"}
}
