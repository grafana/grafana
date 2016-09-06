package conditions

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
)

func init() {
	alerting.RegisterCondition("query", func(model *simplejson.Json, index int) (alerting.Condition, error) {
		return NewQueryCondition(model, index)
	})
}

type QueryCondition struct {
	Index         int
	Query         AlertQuery
	Reducer       QueryReducer
	Evaluator     AlertEvaluator
	HandleRequest tsdb.HandleRequestFunc
}

type AlertQuery struct {
	Model        *simplejson.Json
	DatasourceId int64
	From         string
	To           string
}

func (c *QueryCondition) Eval(context *alerting.EvalContext) {
	seriesList, err := c.executeQuery(context)
	if err != nil {
		context.Error = err
		return
	}

	for _, series := range seriesList {
		reducedValue := c.Reducer.Reduce(series)
		evalMatch := c.Evaluator.Eval(reducedValue)

		if context.IsTestRun {
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Eval: %v, Metric: %s, Value: %1.3f", c.Index, evalMatch, series.Name, *reducedValue),
			})
		}

		if evalMatch {
			context.EvalMatches = append(context.EvalMatches, &alerting.EvalMatch{
				Metric: series.Name,
				Value:  *reducedValue,
			})
		}

		context.Firing = evalMatch

		// handle no data scenario
		if reducedValue == nil {
			context.NoDataFound = true
		}
	}
}

func (c *QueryCondition) executeQuery(context *alerting.EvalContext) (tsdb.TimeSeriesSlice, error) {
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
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
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
					Id:                datasource.Id,
					Name:              datasource.Name,
					PluginId:          datasource.Type,
					Url:               datasource.Url,
					User:              datasource.User,
					Password:          datasource.Password,
					Database:          datasource.Database,
					BasicAuth:         datasource.BasicAuth,
					BasicAuthUser:     datasource.BasicAuthUser,
					BasicAuthPassword: datasource.BasicAuthPassword,
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
	evaluator, err := NewAlertEvaluator(evaluatorJson)
	if err != nil {
		return nil, err
	}

	condition.Evaluator = evaluator
	return &condition, nil
}
