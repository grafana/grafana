package conditions

import (
	"fmt"
	"strings"
	"time"

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

func (c *QueryCondition) Eval(context *alerting.EvalContext) (*alerting.ConditionResult, error) {
	timeRange := tsdb.NewTimeRange(c.Query.From, c.Query.To)

	seriesList, err := c.executeQuery(context, timeRange)
	if err != nil {
		return nil, err
	}

	emptySerieCount := 0
	evalMatchCount := 0
	var matches []*alerting.EvalMatch
	for _, series := range seriesList {
		reducedValue := c.Reducer.Reduce(series)
		evalMatch := c.Evaluator.Eval(reducedValue)

		if reducedValue.Valid == false {
			emptySerieCount++
			continue
		}

		if context.IsTestRun {
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Eval: %v, Metric: %s, Value: %1.3f", c.Index, evalMatch, series.Name, reducedValue.Float64),
			})
		}

		if evalMatch {
			evalMatchCount++

			matches = append(matches, &alerting.EvalMatch{
				Metric: series.Name,
				Value:  reducedValue.Float64,
			})
		}
	}

	return &alerting.ConditionResult{
		Firing:      evalMatchCount > 0,
		NoDataFound: emptySerieCount == len(seriesList),
		EvalMatches: matches,
	}, nil
}

func (c *QueryCondition) executeQuery(context *alerting.EvalContext, timeRange *tsdb.TimeRange) (tsdb.TimeSeriesSlice, error) {
	getDsInfo := &m.GetDataSourceByIdQuery{
		Id:    c.Query.DatasourceId,
		OrgId: context.Rule.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource")
	}

	req := c.getRequestForAlertRule(getDsInfo.Result, timeRange)
	result := make(tsdb.TimeSeriesSlice, 0)

	resp, err := c.HandleRequest(context.Ctx, req)
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

func (c *QueryCondition) getRequestForAlertRule(datasource *m.DataSource, timeRange *tsdb.TimeRange) *tsdb.Request {
	req := &tsdb.Request{
		TimeRange: timeRange,
		Queries: []*tsdb.Query{
			{
				RefId: "A",
				Model: c.Query.Model,
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
					JsonData:          datasource.JsonData,
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

	if err := validateFromValue(condition.Query.From); err != nil {
		return nil, err
	}

	if err := validateToValue(condition.Query.To); err != nil {
		return nil, err
	}

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

func validateFromValue(from string) error {
	fromRaw := strings.Replace(from, "now-", "", 1)

	_, err := time.ParseDuration("-" + fromRaw)
	return err
}

func validateToValue(to string) error {
	if to == "now" {
		return nil
	} else if strings.HasPrefix(to, "now-") {
		withoutNow := strings.Replace(to, "now-", "", 1)

		_, err := time.ParseDuration("-" + withoutNow)
		if err == nil {
			return nil
		}
	}

	_, err := time.ParseDuration(to)
	return err
}
