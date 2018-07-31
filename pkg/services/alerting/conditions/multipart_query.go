package conditions

import (
	gocontext "context"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"

	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/null"
)

func init() {
	alerting.RegisterCondition("multipartQuery", func(model *simplejson.Json, index int) (alerting.Condition, error) {
		return newMultipartQueryCondition(model, index)
	})
}

type MultipartQueryCondition struct {
	Index         int
	QueryParts    []QueryPart
	Evaluator     MultipartEvaluator
	Operator      string
	HandleRequest tsdb.HandleRequestFunc
}

type NamedAlertQuery struct {
	Model        *simplejson.Json
	DatasourceId int64
	ReferenceId  string
	From         string
	To           string
}

type QueryPart struct {
	Query   NamedAlertQuery
	Reducer QueryReducer
	Scalar  null.Float
}

type ReducedSerie struct {
	Name         string
	ReducedValue null.Float
	Tags         map[string]string
}

func (c *MultipartQueryCondition) Eval(context *alerting.EvalContext) (*alerting.ConditionResult, error) {

	resultMaps, err := c.buildReducedMaps(context)
	if err != nil {
		return nil, err
	}

	resultMaps, err = c.normalizeReducedResults(resultMaps)
	if err != nil {
		return nil, err
	}

	emptySerieCount := 0
	evalMatchCount := 0
	var matches []*alerting.EvalMatch

	queryCount := len(resultMaps)
	expectedCount := c.Evaluator.ExpectedQueryCount()
	if queryCount != expectedCount {
		return nil, fmt.Errorf("evaluator/query mismatch: evaluator expected %[1]d queries but got %[2]d", expectedCount, queryCount)
	}

	// get all the series names from the first entry (the reference query)
	for seriesName := range resultMaps[0] {
		var flattenedResults = make([]null.Float, len(resultMaps))
		for i, resultMap := range resultMaps {
			flattenedResults[i] = resultMap[seriesName].ReducedValue
		}

		if !flattenedResults[0].Valid {
			emptySerieCount++
		}
		evalMatch := c.Evaluator.Eval(flattenedResults)

		if context.IsTestRun {
			context.Logs = append(context.Logs, &alerting.ResultLogEntry{
				Message: fmt.Sprintf("Condition[%d]: Eval: %v, Metric: %s, Values: %s", c.Index, evalMatch, seriesName, flattenedResults),
			})
		}
		if evalMatch {
			evalMatchCount++

			matches = append(matches, &alerting.EvalMatch{
				Metric: seriesName,
				Value:  flattenedResults[0],
				Tags:   resultMaps[0][seriesName].Tags,
			})
		}
	}

	return &alerting.ConditionResult{
		Firing:      evalMatchCount > 0,
		NoDataFound: emptySerieCount == len(resultMaps[0]),
		Operator:    c.Operator,
		EvalMatches: matches,
	}, nil
}

func (c *MultipartQueryCondition) buildReducedMaps(context *alerting.EvalContext) ([]map[string]*ReducedSerie, error) {
	var resultSlice []map[string]*ReducedSerie

	for _, queryPart := range c.QueryParts {
		resultMap := map[string]*ReducedSerie{}
		timeRange := tsdb.NewTimeRange(queryPart.Query.From, queryPart.Query.To)

		seriesList, err := c.executeQuery(context, timeRange, queryPart.Query)
		if err != nil {
			return nil, err
		}

		for _, series := range seriesList {
			reducedValue := queryPart.Reducer.Reduce(series)

			if reducedValue.Valid && queryPart.Scalar.Valid {
				reducedValue = null.FloatFrom(reducedValue.Float64 * queryPart.Scalar.Float64)
			}
			resultMap[series.Name] = &ReducedSerie{
				Name:         series.Name,
				ReducedValue: reducedValue,
				Tags:         series.Tags,
			}
		}

		resultSlice = append(resultSlice, resultMap)
	}
	return resultSlice, nil
}

func (c *MultipartQueryCondition) normalizeReducedResults(reducedResults []map[string]*ReducedSerie) ([]map[string]*ReducedSerie, error) {

	// an empty list is already normalized
	if len(reducedResults) == 0 {
		return reducedResults, nil
	}

	referenceSeries := reducedResults[0]
	normalizedResults := make([]map[string]*ReducedSerie, len(reducedResults))
	normalizedResults[0] = referenceSeries

	for i, reducedSeries := range reducedResults[1:] {
		normalizedMap := make(map[string]*ReducedSerie, len(referenceSeries))

		if len(reducedSeries) == len(referenceSeries) {
			for _, referenceSerie := range referenceSeries {
				matchingSerie := reducedSeries[referenceSerie.Name]
				if matchingSerie == nil {
					return nil, fmt.Errorf("unable to normalize queries for comparison: query %[1]d missing series named %[2]s", i+2, referenceSerie.Name)
				} else {
					normalizedMap[referenceSerie.Name] = matchingSerie
				}
			}
		} else if len(reducedSeries) == 1 {
			var reducedSerie *ReducedSerie
			for _, value := range reducedSeries {
				reducedSerie = value
			}
			for _, referenceSerie := range referenceSeries {
				normalizedMap[referenceSerie.Name] = reducedSerie
			}
		} else if len(reducedSeries) == 0 {
			return nil, fmt.Errorf("unable to normalize queries for comparison: query %d returned no results", i+2)
		}
		normalizedResults[i+1] = normalizedMap
	}

	return normalizedResults, nil
}

func newMultipartQueryCondition(model *simplejson.Json, index int) (*MultipartQueryCondition, error) {
	condition := MultipartQueryCondition{}
	condition.Index = index
	condition.HandleRequest = tsdb.HandleRequest

	queryCount := len(model.Get("queryParts").MustArray())

	condition.QueryParts = make([]QueryPart, queryCount)

	for i := range condition.QueryParts {
		condition.QueryParts[i] = QueryPart{}
		queryPartModel := model.Get("queryParts").GetIndex(i)

		err := initializeQuery(&condition.QueryParts[i].Query, queryPartModel.Get("query"))
		if err != nil {
			return nil, err
		}

		condition.QueryParts[i].Reducer = NewSimpleReducer(queryPartModel.Get("reducer").Get("type").MustString())
		scalar, err := queryPartModel.Get("scalar").Float64()
		if err != nil {
			condition.QueryParts[i].Scalar = null.FloatFromPtr(nil)
		} else {
			condition.QueryParts[i].Scalar = null.FloatFrom(scalar)
		}
	}

	evaluatorJson := model.Get("evaluator")
	evaluator, err := newMultipartAlertEvaluator(evaluatorJson)
	if err != nil {
		return nil, err
	}
	condition.Evaluator = evaluator

	operatorJson := model.Get("operator")
	operator := operatorJson.Get("type").MustString("and")
	condition.Operator = operator

	return &condition, nil
}

func initializeQuery(query *NamedAlertQuery, queryJson *simplejson.Json) error {

	query.Model = queryJson.Get("model")
	query.ReferenceId = queryJson.Get("params").GetIndex(0).MustString()
	query.From = queryJson.Get("params").GetIndex(1).MustString()
	query.To = queryJson.Get("params").GetIndex(2).MustString()

	if err := validateFromValue(query.From); err != nil {
		return err
	}

	if err := validateToValue(query.To); err != nil {
		return err
	}

	query.DatasourceId = queryJson.Get("datasourceId").MustInt64()

	return nil
}

func (c *MultipartQueryCondition) executeQuery(context *alerting.EvalContext, timeRange *tsdb.TimeRange, query NamedAlertQuery) (tsdb.TimeSeriesSlice, error) {
	getDsInfo := &m.GetDataSourceByIdQuery{
		Id:    query.DatasourceId,
		OrgId: context.Rule.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("could not find datasource %v", err)
	}

	req := c.getRequestForAlertRule(getDsInfo.Result, timeRange, query)
	result := make(tsdb.TimeSeriesSlice, 0)

	resp, err := c.HandleRequest(context.Ctx, getDsInfo.Result, req)
	if err != nil {
		if err == gocontext.DeadlineExceeded {
			return nil, fmt.Errorf("alert execution exceeded the timeout")
		}

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

func (c *MultipartQueryCondition) getRequestForAlertRule(datasource *m.DataSource, timeRange *tsdb.TimeRange, query NamedAlertQuery) *tsdb.TsdbQuery {
	req := &tsdb.TsdbQuery{
		TimeRange: timeRange,
		Queries: []*tsdb.Query{
			{
				RefId:      query.ReferenceId,
				Model:      query.Model,
				DataSource: datasource,
			},
		},
	}

	return req
}
