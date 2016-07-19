package alerting

import (
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type QueryCondition struct {
	Query     AlertQuery
	Reducer   QueryReducer
	Evaluator AlertEvaluator
}

func (c *QueryCondition) Eval() {
}

func NewQueryCondition(model *simplejson.Json) (*QueryCondition, error) {
	condition := QueryCondition{}

	queryJson := model.Get("query")

	condition.Query.Query = queryJson.Get("query").MustString()
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

func (s *SimpleReducer) Reduce() float64 {
	return 0
}

func NewSimpleReducer(typ string) *SimpleReducer {
	return &SimpleReducer{Type: typ}
}

type DefaultAlertEvaluator struct {
	Type      string
	Threshold float64
}

func (e *DefaultAlertEvaluator) Eval() bool {
	return true
}

func NewDefaultAlertEvaluator(model *simplejson.Json) (*DefaultAlertEvaluator, error) {
	evaluator := &DefaultAlertEvaluator{}

	evaluator.Type = model.Get("type").MustString()
	if evaluator.Type == "" {
		return nil, errors.New("Alert evaluator missing type property")
	}

	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, errors.New("Alert evaluator missing threshold parameter")
	}

	threshold, ok := params[0].(json.Number)
	if !ok {
		return nil, errors.New("Alert evaluator has invalid threshold parameter")
	}

	evaluator.Threshold, _ = threshold.Float64()
	return evaluator, nil
}
