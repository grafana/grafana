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

// AlertEvaluator evaluates the reduced value of a timeseries.
// Returning true if a timeseries is violating the condition
// ex: ThresholdEvaluator, NoValueEvaluator, RangeEvaluator
type AlertEvaluator interface {
	Eval(reducedValue null.Float) bool
}

type noValueEvaluator struct{}

func (e *noValueEvaluator) Eval(reducedValue null.Float) bool {
	return !reducedValue.Valid
}

type thresholdEvaluator struct {
	Type      string
	Threshold float64
}

func newThresholdEvaluator(typ string, model *simplejson.Json) (*thresholdEvaluator, error) {
	params := model.Get("params").MustArray()
	if len(params) == 0 || params[0] == nil {
		return nil, fmt.Errorf("evaluator '%v' is missing the threshold parameter", HumanThresholdType(typ))
	}

	firstParam, ok := params[0].(json.Number)
	if !ok {
		return nil, fmt.Errorf("evaluator has invalid parameter")
	}

	defaultEval := &thresholdEvaluator{Type: typ}
	defaultEval.Threshold, _ = firstParam.Float64()
	return defaultEval, nil
}

func (e *thresholdEvaluator) Eval(reducedValue null.Float) bool {
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

type rangedEvaluator struct {
	Type  string
	Lower float64
	Upper float64
}

func newRangedEvaluator(typ string, model *simplejson.Json) (*rangedEvaluator, error) {
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

	rangedEval := &rangedEvaluator{Type: typ}
	rangedEval.Lower, _ = firstParam.Float64()
	rangedEval.Upper, _ = secondParam.Float64()
	return rangedEval, nil
}

func (e *rangedEvaluator) Eval(reducedValue null.Float) bool {
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

// NewAlertEvaluator is a factory function for returning
// an `AlertEvaluator` depending on the json model.
func NewAlertEvaluator(model *simplejson.Json) (AlertEvaluator, error) {
	typ := model.Get("type").MustString()
	if typ == "" {
		return nil, fmt.Errorf("evaluator missing type property")
	}

	if inSlice(typ, defaultTypes) {
		return newThresholdEvaluator(typ, model)
	}

	if inSlice(typ, rangedTypes) {
		return newRangedEvaluator(typ, model)
	}

	if typ == "no_value" {
		return &noValueEvaluator{}, nil
	}

	return nil, fmt.Errorf("evaluator invalid evaluator type: %s", typ)
}

func inSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

// HumanThresholdType converts a threshold "type" string to a string that matches the UI
// so errors are less confusing.
func HumanThresholdType(typ string) string {
	switch typ {
	case "gt":
		return "IS ABOVE"
	case "lt":
		return "IS BELOW"
	case "within_range":
		return "IS WITHIN RANGE"
	case "outside_range":
		return "IS OUTSIDE RANGE"
	}
	return ""
}
