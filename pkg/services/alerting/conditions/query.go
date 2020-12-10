package conditions

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/prometheus"

	gocontext "context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func init() {
	alerting.RegisterCondition("query", func(model *simplejson.Json, index int) (alerting.Condition, error) {
		return newQueryCondition(model, index)
	})
}

// QueryCondition is responsible for issue and query, reduce the
// timeseries into single values and evaluate if they are firing or not.
type QueryCondition struct {
	Index         int
	Query         AlertQuery
	Reducer       *queryReducer
	Evaluator     AlertEvaluator
	Operator      string
	HandleRequest tsdb.HandleRequestFunc
}

// AlertQuery contains information about what datasource a query
// should be sent to and the query object.
type AlertQuery struct {
	Model        *simplejson.Json
	DatasourceID int64
	From         string
	To           string
}

// Eval evaluates the `QueryCondition`.
func (c *QueryCondition) Eval(context *alerting.EvalContext) (*alerting.ConditionResult, error) {
	timeRange := tsdb.NewTimeRange(c.Query.From, c.Query.To)

	seriesList, err := c.executeQuery(context, timeRange)
	if err != nil {
		return nil, err
	}

	emptySeriesCount := 0
	evalMatchCount := 0
	var matches []*alerting.EvalMatch

	for _, series := range seriesList {
		reducedValue := c.Reducer.Reduce(series)
		evalMatch := c.Evaluator.Eval(reducedValue)

		if !reducedValue.Valid {
			emptySeriesCount++
		}

		if context.IsTestRun {
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Eval: %v, Metric: %s, Value: %s", c.Index, evalMatch, series.Name, reducedValue),
			})
		}

		if evalMatch {
			evalMatchCount++

			matches = append(matches, &alerting.EvalMatch{
				Metric: series.Name,
				Value:  reducedValue,
				Tags:   series.Tags,
			})
		}
	}

	// handle no series special case
	if len(seriesList) == 0 {
		// eval condition for null value
		evalMatch := c.Evaluator.Eval(null.FloatFromPtr(nil))

		if context.IsTestRun {
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
				Message: fmt.Sprintf("Condition: Eval: %v, Query Returned No Series (reduced to null/no value)", evalMatch),
			})
		}

		if evalMatch {
			evalMatchCount++
			matches = append(matches, &alerting.EvalMatch{Metric: "NoData", Value: null.FloatFromPtr(nil)})
		}
	}

	return &alerting.ConditionResult{
		Firing:      evalMatchCount > 0,
		NoDataFound: emptySeriesCount == len(seriesList),
		Operator:    c.Operator,
		EvalMatches: matches,
	}, nil
}

func (c *QueryCondition) executeQuery(context *alerting.EvalContext, timeRange *tsdb.TimeRange) (tsdb.TimeSeriesSlice, error) {
	getDsInfo := &models.GetDataSourceByIdQuery{
		Id:    c.Query.DatasourceID,
		OrgId: context.Rule.OrgID,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("could not find datasource: %w", err)
	}

	req := c.getRequestForAlertRule(getDsInfo.Result, timeRange, context.IsDebug)
	result := make(tsdb.TimeSeriesSlice, 0)

	if context.IsDebug {
		data := simplejson.New()
		if req.TimeRange != nil {
			data.Set("from", req.TimeRange.GetFromAsMsEpoch())
			data.Set("to", req.TimeRange.GetToAsMsEpoch())
		}

		type queryDto struct {
			RefID         string           `json:"refId"`
			Model         *simplejson.Json `json:"model"`
			Datasource    *simplejson.Json `json:"datasource"`
			MaxDataPoints int64            `json:"maxDataPoints"`
			IntervalMs    int64            `json:"intervalMs"`
		}

		queries := []*queryDto{}
		for _, q := range req.Queries {
			queries = append(queries, &queryDto{
				RefID: q.RefId,
				Model: q.Model,
				Datasource: simplejson.NewFromAny(map[string]interface{}{
					"id":   q.DataSource.Id,
					"name": q.DataSource.Name,
				}),
				MaxDataPoints: q.MaxDataPoints,
				IntervalMs:    q.IntervalMs,
			})
		}

		data.Set("queries", queries)

		context.Logs = append(context.Logs, &alerting.ResultLogEntry{
			Message: fmt.Sprintf("Condition[%d]: Query", c.Index),
			Data:    data,
		})
	}

	resp, err := c.HandleRequest(context.Ctx, getDsInfo.Result, req)
	if err != nil {
		return nil, toCustomError(err)
	}

	for _, v := range resp.Results {
		if v.Error != nil {
			return nil, fmt.Errorf("tsdb.HandleRequest() response error %v", v)
		}

		// If there are dataframes but no series on the result
		useDataframes := v.Dataframes != nil && (v.Series == nil || len(v.Series) == 0)

		if useDataframes { // convert the dataframes to tsdb.TimeSeries
			frames, err := v.Dataframes.Decoded()
			if err != nil {
				return nil, errutil.Wrap("tsdb.HandleRequest() failed to unmarshal arrow dataframes from bytes", err)
			}

			for _, frame := range frames {
				ss, err := FrameToSeriesSlice(frame)
				if err != nil {
					return nil, errutil.Wrapf(err, `tsdb.HandleRequest() failed to convert dataframe "%v" to tsdb.TimeSeriesSlice`, frame.Name)
				}
				result = append(result, ss...)
			}
		} else {
			result = append(result, v.Series...)
		}

		queryResultData := map[string]interface{}{}

		if context.IsTestRun {
			queryResultData["series"] = result
		}

		if context.IsDebug && v.Meta != nil {
			queryResultData["meta"] = v.Meta
		}

		if context.IsTestRun || context.IsDebug {
			if useDataframes {
				queryResultData["fromDataframe"] = true
			}
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Query Result", c.Index),
				Data:    simplejson.NewFromAny(queryResultData),
			})
		}
	}

	return result, nil
}

func (c *QueryCondition) getRequestForAlertRule(datasource *models.DataSource, timeRange *tsdb.TimeRange, debug bool) *tsdb.TsdbQuery {
	queryModel := c.Query.Model
	req := &tsdb.TsdbQuery{
		TimeRange: timeRange,
		Queries: []*tsdb.Query{
			{
				RefId:      "A",
				Model:      queryModel,
				DataSource: datasource,
				QueryType:  queryModel.Get("queryType").MustString(""),
			},
		},
		Headers: map[string]string{
			"FromAlert": "true",
		},
		Debug: debug,
	}

	return req
}

func newQueryCondition(model *simplejson.Json, index int) (*QueryCondition, error) {
	condition := QueryCondition{}
	condition.Index = index
	condition.HandleRequest = tsdb.HandleRequest

	queryJSON := model.Get("query")

	condition.Query.Model = queryJSON.Get("model")
	condition.Query.From = queryJSON.Get("params").MustArray()[1].(string)
	condition.Query.To = queryJSON.Get("params").MustArray()[2].(string)

	if err := validateFromValue(condition.Query.From); err != nil {
		return nil, err
	}

	if err := validateToValue(condition.Query.To); err != nil {
		return nil, err
	}

	condition.Query.DatasourceID = queryJSON.Get("datasourceId").MustInt64()

	reducerJSON := model.Get("reducer")
	condition.Reducer = newSimpleReducer(reducerJSON.Get("type").MustString())

	evaluatorJSON := model.Get("evaluator")
	evaluator, err := NewAlertEvaluator(evaluatorJSON)
	if err != nil {
		return nil, fmt.Errorf("error in condition %v: %v", index, err)
	}
	condition.Evaluator = evaluator

	operatorJSON := model.Get("operator")
	operator := operatorJSON.Get("type").MustString("and")
	condition.Operator = operator

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

// FrameToSeriesSlice converts a frame that is a valid time series as per data.TimeSeriesSchema()
// to a TimeSeriesSlice.
func FrameToSeriesSlice(frame *data.Frame) (tsdb.TimeSeriesSlice, error) {
	tsSchema := frame.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		// If no fields, or only a time field, create an empty tsdb.TimeSeriesSlice with a single
		// time series in order to trigger "no data" in alerting.
		if len(frame.Fields) == 0 || (len(frame.Fields) == 1 && frame.Fields[0].Type().Time()) {
			return tsdb.TimeSeriesSlice{{
				Name:   frame.Name,
				Points: make(tsdb.TimeSeriesPoints, 0),
			}}, nil
		}
		return nil, fmt.Errorf("input frame is not recognized as a time series")
	}

	seriesCount := len(tsSchema.ValueIndices)
	seriesSlice := make(tsdb.TimeSeriesSlice, 0, seriesCount)
	timeField := frame.Fields[tsSchema.TimeIndex]
	timeNullFloatSlice := make([]null.Float, timeField.Len())

	for i := 0; i < timeField.Len(); i++ { // built slice of time as epoch ms in null floats
		tStamp, err := timeField.FloatAt(i)
		if err != nil {
			return nil, err
		}
		timeNullFloatSlice[i] = null.FloatFrom(tStamp)
	}

	for _, fieldIdx := range tsSchema.ValueIndices { // create a TimeSeries for each value Field
		field := frame.Fields[fieldIdx]
		ts := &tsdb.TimeSeries{
			Points: make(tsdb.TimeSeriesPoints, field.Len()),
		}

		switch {
		case field.Config != nil && field.Config.DisplayName != "":
			ts.Name = field.Config.DisplayName
		case field.Config != nil && field.Config.DisplayNameFromDS != "":
			ts.Name = field.Config.DisplayNameFromDS
		case len(field.Labels) > 0:
			ts.Tags = field.Labels.Copy()
			// Tags are appended to the name so they are eventually included in EvalMatch's Metric property
			// for display in notifications.
			ts.Name = fmt.Sprintf("%v {%v}", field.Name, field.Labels.String())
		default:
			ts.Name = field.Name
		}

		for rowIdx := 0; rowIdx < field.Len(); rowIdx++ { // for each value in the field, make a TimePoint
			val, err := field.FloatAt(rowIdx)
			if err != nil {
				return nil, errutil.Wrapf(err, "failed to convert frame to tsdb.series, can not convert value %v to float", field.At(rowIdx))
			}
			ts.Points[rowIdx] = tsdb.TimePoint{
				null.FloatFrom(val),
				timeNullFloatSlice[rowIdx],
			}
		}

		seriesSlice = append(seriesSlice, ts)
	}

	return seriesSlice, nil
}

func toCustomError(err error) error {
	// is context timeout
	if errors.Is(err, gocontext.DeadlineExceeded) {
		return fmt.Errorf("alert execution exceeded the timeout")
	}

	// is Prometheus error
	if prometheus.IsAPIError(err) {
		return prometheus.ConvertAPIError(err)
	}

	// generic fallback
	return fmt.Errorf("tsdb.HandleRequest() error %v", err)
}
