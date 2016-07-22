package alerting

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type QueryCondition struct {
	Index         int
	Query         AlertQuery
	Reducer       QueryReducer
	Evaluator     AlertEvaluator
	HandleRequest tsdb.HandleRequestFunc
}

func (c *QueryCondition) Eval(context *AlertResultContext) {
	seriesList, err := c.executeQuery(context)
	if err != nil {
		context.Error = err
		return
	}

	for _, series := range seriesList {
		reducedValue := c.Reducer.Reduce(series)
		pass := c.Evaluator.Eval(series, reducedValue)

		if context.IsTestRun {
			context.Logs = append(context.Logs, &AlertResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Eval: %v, Metric: %s, Value: %1.3f", c.Index, pass, series.Name, reducedValue),
			})
		}

		if pass {
			context.Events = append(context.Events, &AlertEvent{
				Metric: series.Name,
				Value:  reducedValue,
			})
			context.Firing = true
			break
		}
	}
}

func (c *QueryCondition) executeQuery(context *AlertResultContext) (tsdb.TimeSeriesSlice, error) {
	getDsInfo := &m.GetDataSourceByIdQuery{
		Id:    c.Query.DatasourceId,
		OrgId: context.Rule.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource")
	}

	req := c.getRequestForAlertRule(getDsInfo.Result)
	result := make(tsdb.TimeSeriesSlice, 0)

	resp, err := c.HandleRequest(req)
	if err != nil {
		return nil, fmt.Errorf("tsdb.HandleRequest() error %v", err)
	}

	for _, v := range resp.Results {
		if v.Error != nil {
			return nil, fmt.Errorf("tsdb.HandleRequest() response error %v", v)
		}

		result = append(result, v.Series...)

		if context.IsTestRun {
			context.Logs = append(context.Logs, &AlertResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Query Result", c.Index),
				Data:    v.Series,
			})
		}
	}

	return result, nil
}

func (c *QueryCondition) getRequestForAlertRule(datasource *m.DataSource) *tsdb.Request {
	req := &tsdb.Request{
		TimeRange: tsdb.TimeRange{
			From: c.Query.From,
			To:   c.Query.To,
		},
		Queries: []*tsdb.Query{
			{
				RefId: "A",
				Query: c.Query.Model.Get("target").MustString(),
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

func NewQueryCondition(model *simplejson.Json, index int) (*QueryCondition, error) {
	condition := QueryCondition{}
	condition.Index = index
	condition.HandleRequest = tsdb.HandleRequest

	queryJson := model.Get("query")

	condition.Query.Model = queryJson.Get("model")
	condition.Query.From = queryJson.Get("params").MustArray()[1].(string)
	condition.Query.To = queryJson.Get("params").MustArray()[2].(string)
	condition.Query.DatasourceId = queryJson.Get("datasourceId").MustInt64()

	reducerJson := model.Get("reducer")
	condition.Reducer = NewSimpleReducer(reducerJson.Get("type").MustString())

	evaluatorJson := model.Get("evaluator")
	evaluator, err := NewDefaultAlertEvaluator(evaluatorJson)
	if err != nil {
		return nil, err
	}

	condition.Evaluator = evaluator
	return &condition, nil
}

type SimpleReducer struct {
	Type string
}

func (s *SimpleReducer) Reduce(series *tsdb.TimeSeries) float64 {
	var value float64 = 0

	switch s.Type {
	case "avg":
		for _, point := range series.Points {
			value += point[0]
		}
		value = value / float64(len(series.Points))
	}

	return value
}

func NewSimpleReducer(typ string) *SimpleReducer {
	return &SimpleReducer{Type: typ}
}

type DefaultAlertEvaluator struct {
	Type      string
	Threshold float64
}

func (e *DefaultAlertEvaluator) Eval(series *tsdb.TimeSeries, reducedValue float64) bool {
	switch e.Type {
	case ">":
		return reducedValue > e.Threshold
	case "<":
		return reducedValue < e.Threshold
	}

	return false
}

func NewDefaultAlertEvaluator(model *simplejson.Json) (*DefaultAlertEvaluator, error) {
	evaluator := &DefaultAlertEvaluator{}

	evaluator.Type = model.Get("type").MustString()
	if evaluator.Type == "" {
		return nil, AlertValidationError{Reason: "Evaluator missing type property"}
	}

	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, AlertValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	threshold, ok := params[0].(json.Number)
	if !ok {
		return nil, AlertValidationError{Reason: "Evaluator has invalid threshold parameter"}
	}

	evaluator.Threshold, _ = threshold.Float64()
	return evaluator, nil
}
