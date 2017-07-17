package conditions

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	defaultTypes []string = []string{"gt", "lt"}
	queryTypes   []string = []string{"above_metric", "below_metric"}
	rangedTypes  []string = []string{"within_range", "outside_range"}
)

type AlertEvaluator interface {
	Update(ctx *alerting.EvalContext) error
	Eval(seriesName string, reducedValue null.Float) bool
}

type NoValueEvaluator struct{}

func (e *NoValueEvaluator) Update(ctx *alerting.EvalContext) error {
	return nil
}

func (e *NoValueEvaluator) Eval(seriesName string, reducedValue null.Float) bool {
	return reducedValue.Valid == false
}

type ThresholdEvaluator struct {
	Type      string
	Threshold float64
}

func newThresholdEvaluator(typ string, model *simplejson.Json) (*ThresholdEvaluator, error) {
	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, alerting.ValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	firstParam, ok := params[0].(json.Number)
	if !ok {
		return nil, alerting.ValidationError{Reason: "Evaluator has invalid parameter"}
	}

	defaultEval := &ThresholdEvaluator{Type: typ}
	defaultEval.Threshold, _ = firstParam.Float64()
	return defaultEval, nil
}

func (e *ThresholdEvaluator) Update(ctx *alerting.EvalContext) error {
	return nil
}

func (e *ThresholdEvaluator) Eval(seriesName string, reducedValue null.Float) bool {
	if reducedValue.Valid == false {
		return false
	}

	switch e.Type {
	case "gt":
		return reducedValue.Float64 > e.Threshold
	case "lt":
		return reducedValue.Float64 < e.Threshold
	}

	return false
}

type RangedEvaluator struct {
	Type  string
	Lower float64
	Upper float64
}

func newRangedEvaluator(typ string, model *simplejson.Json) (*RangedEvaluator, error) {
	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, alerting.ValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	firstParam, ok := params[0].(json.Number)
	if !ok {
		return nil, alerting.ValidationError{Reason: "Evaluator has invalid parameter"}
	}

	secondParam, ok := params[1].(json.Number)
	if !ok {
		return nil, alerting.ValidationError{Reason: "Evaluator has invalid second parameter"}
	}

	rangedEval := &RangedEvaluator{Type: typ}
	rangedEval.Lower, _ = firstParam.Float64()
	rangedEval.Upper, _ = secondParam.Float64()
	return rangedEval, nil
}

func (e *RangedEvaluator) Update(context *alerting.EvalContext) error {
	return nil
}

func (e *RangedEvaluator) Eval(seriesName string, reducedValue null.Float) bool {
	if reducedValue.Valid == false {
		return false
	}

	floatValue := reducedValue.Float64

	switch e.Type {
	case "within_range":
		return (e.Lower < floatValue && e.Upper > floatValue) || (e.Upper < floatValue && e.Lower > floatValue)
	case "outside_range":
		return (e.Upper < floatValue && e.Lower < floatValue) || (e.Upper > floatValue && e.Lower > floatValue)
	}

	return false
}

type QueryEvaluator struct {
	Type             string
	ParentCondition  *QueryCondition
	ReferenceScalar  float64
	ReferenceQuery   AlertQuery
	ReferenceReducer QueryReducer
	QueryResults     tsdb.TimeSeriesSlice
}

func newQueryEvaluator(parentCondition *QueryCondition, typ string, model *simplejson.Json) (AlertEvaluator, error) {
	queryEvaluator := QueryEvaluator{}
	queryEvaluator.ParentCondition = parentCondition
	queryEvaluator.Type = typ

	referenceScalar, ok := model.Get("params").MustArray()[0].(json.Number)
	if !ok {
		return nil, alerting.ValidationError{Reason: "Query alert missing scalar parameter"}
	}

	scalarValue, err := referenceScalar.Float64()
	if err != nil {
		return nil, alerting.ValidationError{Reason: "Query alert scalar parameter is malformed (should be a floating point value"}
	}
	queryEvaluator.ReferenceScalar = scalarValue

	queryModel := model.Get("params").GetIndex(1)
	queryEvaluator.ReferenceQuery.Model = queryModel

	queryEvaluator.ReferenceQuery.From = queryModel.Get("params").MustArray()[1].(string)
	queryEvaluator.ReferenceQuery.To = queryModel.Get("params").MustArray()[2].(string)

	if err := validateFromValue(queryEvaluator.ReferenceQuery.From); err != nil {
		return nil, err
	}

	if err := validateToValue(queryEvaluator.ReferenceQuery.To); err != nil {
		return nil, err
	}

	queryEvaluator.ReferenceQuery.DatasourceId = parentCondition.Query.DatasourceId

	reducerJson := model.Get("params").GetIndex(2)
	queryEvaluator.ReferenceReducer = NewSimpleReducer(reducerJson.Get("type").MustString())

	return &queryEvaluator, nil
}

func (e *QueryEvaluator) Update(context *alerting.EvalContext) error {
	timeRange := tsdb.NewTimeRange(e.ReferenceQuery.From, e.ReferenceQuery.To)

	var err error
	e.QueryResults, err = e.ParentCondition.executeQuery(context, timeRange)

	return err
}

func (e *QueryEvaluator) Eval(seriesName string, reducedValue null.Float) bool {
	if reducedValue.Valid == false || len(e.QueryResults) == 0 {
		return false
	}

	var series *tsdb.TimeSeries
	// Match series for evaluation if the names are the same
	for _, item := range e.QueryResults {
		if item.Name == seriesName {
			series = item
		}
	}

	// no matches, just go with the first one
	if series == nil {
		series = e.QueryResults[0]
	}

	referenceReducedValue := e.ReferenceReducer.Reduce(series)
	referenceFloatValue := e.ReferenceScalar * referenceReducedValue.Float64

	switch e.Type {
	case "above_metric":
		return reducedValue.Float64 > referenceFloatValue
	case "below_metric":
		return reducedValue.Float64 < referenceFloatValue
	}

	return false
}

func NewAlertEvaluator(condition *QueryCondition, model *simplejson.Json) (AlertEvaluator, error) {
	typ := model.Get("type").MustString()
	if typ == "" {
		return nil, alerting.ValidationError{Reason: "Evaluator missing type property"}
	}

	if inSlice(typ, defaultTypes) {
		return newThresholdEvaluator(typ, model)
	}

	if inSlice(typ, rangedTypes) {
		return newRangedEvaluator(typ, model)
	}

	if inSlice(typ, queryTypes) {
		return newQueryEvaluator(condition, typ, model)
	}

	if typ == "no_value" {
		return &NoValueEvaluator{}, nil
	}

	return nil, alerting.ValidationError{Reason: "Evaluator invalid evaluator type: " + typ}
}

func inSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}
