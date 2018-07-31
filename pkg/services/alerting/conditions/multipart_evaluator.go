package conditions

import (
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type MultipartEvaluator interface {
	Eval(reducedValues []null.Float) bool
	ExpectedQueryCount() int
}

func newMultipartAlertEvaluator(model *simplejson.Json) (MultipartEvaluator, error) {
	defaultTypes := []string{"gt-query", "lt-query"}

	modelType := model.Get("type").MustString()
	if modelType == "" {
		return nil, alerting.ValidationError{Reason: "Evaluator missing type property"}
	}

	if inSlice(modelType, defaultTypes) {
		return newQueryComparisonEvaluator(modelType, model)
	}

	return nil, alerting.ValidationError{Reason: "Evaluator invalid evaluator type: " + modelType}
}

type QueryComparisonEvaluator struct {
	Type string
}

func newQueryComparisonEvaluator(modelType string, model *simplejson.Json) (MultipartEvaluator, error) {
	evaluator := QueryComparisonEvaluator{}
	evaluator.Type = modelType

	return &evaluator, nil
}

func (e *QueryComparisonEvaluator) Eval(reducedValues []null.Float) bool {

	value := reducedValues[0]
	reference := reducedValues[1]

	if !value.Valid || !reference.Valid {
		return false
	}

	switch e.Type {
	case "gt-query":
		return value.Float64 > reference.Float64
	case "lt-query":
		return value.Float64 < reference.Float64
	}

	return false
}

func (e *QueryComparisonEvaluator) ExpectedQueryCount() int {
	return 2
}
