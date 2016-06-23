package alerting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	descriptionFmt = "Actual value: %1.2f for %s. "
)

type HandlerImpl struct {
	log log.Logger
}

func NewHandler() *HandlerImpl {
	return &HandlerImpl{
		log: log.New("alerting.executor"),
	}
}

func (e *HandlerImpl) Execute(job *AlertJob, resultQueue chan *AlertResult) {
	timeSeries, err := e.executeQuery(job)
	if err != nil {
		resultQueue <- &AlertResult{
			Error:         err,
			State:         alertstates.Pending,
			AlertJob:      job,
			ExeuctionTime: time.Now(),
		}
	}

	result := e.evaluateRule(job.Rule, timeSeries)
	result.AlertJob = job
	resultQueue <- result
}

func (e *HandlerImpl) executeQuery(job *AlertJob) (tsdb.TimeSeriesSlice, error) {
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

func (e *HandlerImpl) GetRequestForAlertRule(rule *AlertRule, datasource *m.DataSource) *tsdb.Request {
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

func (e *HandlerImpl) evaluateRule(rule *AlertRule, series tsdb.TimeSeriesSlice) *AlertResult {
	e.log.Debug("Evaluating Alerting Rule", "seriesCount", len(series), "ruleName", rule.Name)

	triggeredAlert := make([]*TriggeredAlert, 0)

	for _, serie := range series {
		e.log.Debug("Evaluating series", "series", serie.Name)
		transformedValue, _ := rule.Transformer.Transform(serie)

		critResult := evalCondition(rule.Critical, transformedValue)
		condition2 := fmt.Sprintf("%v %s %v ", transformedValue, rule.Critical.Operator, rule.Critical.Value)
		e.log.Debug("Alert execution Crit", "name", serie.Name, "condition", condition2, "result", critResult)
		if critResult {
			triggeredAlert = append(triggeredAlert, &TriggeredAlert{
				State:       alertstates.Critical,
				ActualValue: transformedValue,
				Name:        serie.Name,
			})
			continue
		}

		warnResult := evalCondition(rule.Warning, transformedValue)
		condition := fmt.Sprintf("%v %s %v ", transformedValue, rule.Warning.Operator, rule.Warning.Value)
		e.log.Debug("Alert execution Warn", "name", serie.Name, "condition", condition, "result", warnResult)
		if warnResult {
			triggeredAlert = append(triggeredAlert, &TriggeredAlert{
				State:       alertstates.Warn,
				ActualValue: transformedValue,
				Name:        serie.Name,
			})
		}
	}

	executionState := alertstates.Ok
	for _, raised := range triggeredAlert {
		if raised.State == alertstates.Critical {
			executionState = alertstates.Critical
		}

		if executionState != alertstates.Critical && raised.State == alertstates.Warn {
			executionState = alertstates.Warn
		}
	}

	return &AlertResult{State: executionState, Description: "Returned " + executionState, TriggeredAlerts: triggeredAlert, ExeuctionTime: time.Now()}
}
