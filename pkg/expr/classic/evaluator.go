package classic

import (
	"fmt"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

type EvaluatorKind int

const (
	EvaluatorNoValue = iota
	EvaluatorThreshold
	EvaluatorRanged
)

type evaluator interface {
	Eval(mathexp.Number) bool
	Kind() EvaluatorKind
}

type noValueEvaluator struct{}

func (noValueEvaluator) Kind() EvaluatorKind {
	return EvaluatorNoValue
}

type thresholdEvaluator struct {
	Type      string
	Threshold float64
}

func (thresholdEvaluator) Kind() EvaluatorKind {
	return EvaluatorThreshold
}

type rangedEvaluator struct {
	Type  string
	Lower float64
	Upper float64
}

func (rangedEvaluator) Kind() EvaluatorKind {
	return EvaluatorRanged
}

// newAlertEvaluator is a factory function for returning
// an AlertEvaluator depending on evaluation operator.
func newAlertEvaluator(model ConditionEvalJSON) (evaluator, error) {
	switch model.Type {
	case "gt", "lt", "eq", "ne", "gte", "lte":
		return newThresholdEvaluator(model)
	case "within_range", "outside_range", "within_range_included", "outside_range_included":
		return newRangedEvaluator(model)
	case "no_value":
		return &noValueEvaluator{}, nil
	}

	return nil, fmt.Errorf("evaluator invalid evaluator type: %s", model.Type)
}

func (e *thresholdEvaluator) Eval(reducedValue mathexp.Number) bool {
	fv := reducedValue.GetFloat64Value()
	if fv == nil {
		return false
	}

	switch e.Type {
	case "gt":
		return *fv > e.Threshold
	case "lt":
		return *fv < e.Threshold
	case "eq":
		return *fv == e.Threshold
	case "ne":
		return *fv != e.Threshold
	case "gte":
		return *fv >= e.Threshold
	case "lte":
		return *fv <= e.Threshold
	}

	return false
}

func newThresholdEvaluator(model ConditionEvalJSON) (*thresholdEvaluator, error) {
	if len(model.Params) == 0 {
		return nil, fmt.Errorf("evaluator '%v' is missing the threshold parameter", model.Type)
	}

	return &thresholdEvaluator{
		Type:      model.Type,
		Threshold: model.Params[0],
	}, nil
}

func (e *noValueEvaluator) Eval(reducedValue mathexp.Number) bool {
	return reducedValue.GetFloat64Value() == nil
}

func newRangedEvaluator(model ConditionEvalJSON) (*rangedEvaluator, error) {
	if len(model.Params) != 2 {
		return nil, fmt.Errorf("ranged evaluator requires 2 parameters")
	}

	return &rangedEvaluator{
		Type:  model.Type,
		Lower: model.Params[0],
		Upper: model.Params[1],
	}, nil
}

func (e *rangedEvaluator) Eval(reducedValue mathexp.Number) bool {
	fv := reducedValue.GetFloat64Value()
	if fv == nil {
		return false
	}

	switch e.Type {
	case "within_range":
		return (e.Lower < *fv && e.Upper > *fv) || (e.Upper < *fv && e.Lower > *fv)
	case "outside_range":
		return (e.Upper < *fv && e.Lower < *fv) || (e.Upper > *fv && e.Lower > *fv)
	case "within_range_included":
		return (e.Lower <= *fv && e.Upper >= *fv) || (e.Upper <= *fv && e.Lower >= *fv)
	case "outside_range_included":
		return (e.Upper <= *fv && e.Lower <= *fv) || (e.Upper >= *fv && e.Lower >= *fv)
	}

	return false
}
