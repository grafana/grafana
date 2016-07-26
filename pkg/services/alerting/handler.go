package alerting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/log"
)

var (
	descriptionFmt = "Actual value: %1.2f for %s. "
)

type HandlerImpl struct {
	log             log.Logger
	alertJobTimeout time.Duration
}

func NewHandler() *HandlerImpl {
	return &HandlerImpl{
		log:             log.New("alerting.handler"),
		alertJobTimeout: time.Second * 5,
	}
}

func (e *HandlerImpl) Execute(context *AlertResultContext) {

	go e.eval(context)

	select {
	case <-time.After(e.alertJobTimeout):
		context.Error = fmt.Errorf("Timeout")
		context.EndTime = time.Now()
		e.log.Debug("Job Execution timeout", "alertId", context.Rule.Id)
	case <-context.DoneChan:
		e.log.Debug("Job Execution done", "timeMs", context.GetDurationMs(), "alertId", context.Rule.Id, "firing", context.Firing)
	}

}

func (e *HandlerImpl) eval(context *AlertResultContext) {

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
	context.DoneChan <- true
}

// func (e *HandlerImpl) executeQuery(job *AlertJob) (tsdb.TimeSeriesSlice, error) {
// 	getDsInfo := &m.GetDataSourceByIdQuery{
// 		Id:    job.Rule.Query.DatasourceId,
// 		OrgId: job.Rule.OrgId,
// 	}
//
// 	if err := bus.Dispatch(getDsInfo); err != nil {
// 		return nil, fmt.Errorf("Could not find datasource")
// 	}
//
// 	req := e.GetRequestForAlertRule(job.Rule, getDsInfo.Result)
// 	result := make(tsdb.TimeSeriesSlice, 0)
//
// 	resp, err := tsdb.HandleRequest(req)
// 	if err != nil {
// 		return nil, fmt.Errorf("Alerting: GetSeries() tsdb.HandleRequest() error %v", err)
// 	}
//
// 	for _, v := range resp.Results {
// 		if v.Error != nil {
// 			return nil, fmt.Errorf("Alerting: GetSeries() tsdb.HandleRequest() response error %v", v)
// 		}
//
// 		result = append(result, v.Series...)
// 	}
//
// 	return result, nil
// }
//
// func (e *HandlerImpl) GetRequestForAlertRule(rule *AlertRule, datasource *m.DataSource) *tsdb.Request {
// 	e.log.Debug("GetRequest", "query", rule.Query.Query, "from", rule.Query.From, "datasourceId", datasource.Id)
// 	req := &tsdb.Request{
// 		TimeRange: tsdb.TimeRange{
// 			From: "-" + rule.Query.From,
// 			To:   rule.Query.To,
// 		},
// 		Queries: []*tsdb.Query{
// 			{
// 				RefId: "A",
// 				Query: rule.Query.Query,
// 				DataSource: &tsdb.DataSourceInfo{
// 					Id:       datasource.Id,
// 					Name:     datasource.Name,
// 					PluginId: datasource.Type,
// 					Url:      datasource.Url,
// 				},
// 			},
// 		},
// 	}
//
// 	return req
// }
//
// func (e *HandlerImpl) evaluateRule(rule *AlertRule, series tsdb.TimeSeriesSlice) *AlertResult {
// 	e.log.Debug("Evaluating Alerting Rule", "seriesCount", len(series), "ruleName", rule.Name)
//
// 	triggeredAlert := make([]*TriggeredAlert, 0)
//
// 	for _, serie := range series {
// 		e.log.Debug("Evaluating series", "series", serie.Name)
// 		transformedValue, _ := rule.Transformer.Transform(serie)
//
// 		critResult := evalCondition(rule.Critical, transformedValue)
// 		condition2 := fmt.Sprintf("%v %s %v ", transformedValue, rule.Critical.Operator, rule.Critical.Value)
// 		e.log.Debug("Alert execution Crit", "name", serie.Name, "condition", condition2, "result", critResult)
// 		if critResult {
// 			triggeredAlert = append(triggeredAlert, &TriggeredAlert{
// 				State:  alertstates.Critical,
// 				Value:  transformedValue,
// 				Metric: serie.Name,
// 			})
// 			continue
// 		}
//
// 		warnResult := evalCondition(rule.Warning, transformedValue)
// 		condition := fmt.Sprintf("%v %s %v ", transformedValue, rule.Warning.Operator, rule.Warning.Value)
// 		e.log.Debug("Alert execution Warn", "name", serie.Name, "condition", condition, "result", warnResult)
// 		if warnResult {
// 			triggeredAlert = append(triggeredAlert, &TriggeredAlert{
// 				State:  alertstates.Warn,
// 				Value:  transformedValue,
// 				Metric: serie.Name,
// 			})
// 		}
// 	}
//
// 	executionState := alertstates.Ok
// 	for _, raised := range triggeredAlert {
// 		if raised.State == alertstates.Critical {
// 			executionState = alertstates.Critical
// 		}
//
// 		if executionState != alertstates.Critical && raised.State == alertstates.Warn {
// 			executionState = alertstates.Warn
// 		}
// 	}
//
// 	return &AlertResult{State: executionState, TriggeredAlerts: triggeredAlert}
// }
