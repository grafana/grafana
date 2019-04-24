package conditions

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
)

var (
	defaultTypes = []string{"gt", "lt"}
	rangedTypes  = []string{"within_range", "outside_range"}
)

type AlertEvaluator interface {
	Eval(reducedValue null.Float) bool
}

type NoValueEvaluator struct{}

func (e *NoValueEvaluator) Eval(reducedValue null.Float) bool {
	return !reducedValue.Valid
}

type ThresholdEvaluator struct {
	Type      string
	Threshold float64
}

func newThresholdEvaluator(typ string, model *simplejson.Json) (*ThresholdEvaluator, error) {
	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, fmt.Errorf("Evaluator missing threshold parameter")
	}

	firstParam, ok := params[0].(json.Number)
	if !ok {
		return nil, fmt.Errorf("Evaluator has invalid parameter")
	}

	defaultEval := &ThresholdEvaluator{Type: typ}
	defaultEval.Threshold, _ = firstParam.Float64()
	return defaultEval, nil
}

func (e *ThresholdEvaluator) Eval(reducedValue null.Float) bool {
	if !reducedValue.Valid {
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

func (e *RangedEvaluator) Eval(reducedValue null.Float) bool {
	if !reducedValue.Valid {
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

func NewAlertEvaluator(model *simplejson.Json) (AlertEvaluator, error) {
	typ := model.Get("type").MustString()
	if typ == "" {
		return nil, fmt.Errorf("Evaluator missing type property")
	}

	if inSlice(typ, defaultTypes) {
		return newThresholdEvaluator(typ, model)
	}

	if inSlice(typ, rangedTypes) {
		return newRangedEvaluator(typ, model)
	}

	if typ == "no_value" {
		return &NoValueEvaluator{}, nil
	}

	return nil, fmt.Errorf("Evaluator invalid evaluator type: %s", typ)
}

func inSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}
