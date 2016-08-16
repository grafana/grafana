package conditions

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type AlertEvaluator interface {
	Eval(timeSeries *tsdb.TimeSeries, reducedValue float64) bool
}

type DefaultAlertEvaluator struct {
	Type      string
	Threshold float64
}

func (e *DefaultAlertEvaluator) Eval(series *tsdb.TimeSeries, reducedValue float64) bool {
	switch e.Type {
	case "gt":
		return reducedValue > e.Threshold
	case "lt":
		return reducedValue < e.Threshold
	}

	return false
}

type RangedAlertEvaluator struct {
	Type  string
	Lower float64
	Upper float64
}

func (e *RangedAlertEvaluator) Eval(series *tsdb.TimeSeries, reducedValue float64) bool {
	switch e.Type {
	case "within_range":
		return (e.Lower < reducedValue && e.Upper > reducedValue) || (e.Upper < reducedValue && e.Lower > reducedValue)
	case "outside_range":
		return (e.Upper < reducedValue && e.Lower < reducedValue) || (e.Upper > reducedValue && e.Lower > reducedValue)
	}

	return false
}

func NewAlertEvaluator(model *simplejson.Json) (AlertEvaluator, error) {
	defaultTypes := []string{"gt", "lt"}
	rangedTypes := []string{"within_range", "outside_range"}

	typ := model.Get("type").MustString()

	if typ == "" {
		return nil, alerting.ValidationError{Reason: "Evaluator missing type property"}
	}

	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, alerting.ValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	firstParam, ok := params[0].(json.Number)
	if !ok {
		return nil, alerting.ValidationError{Reason: "Evaluator has invalid threshold parameter"}
	}

	if stringInSlice(typ, defaultTypes) {
		evaluator := &DefaultAlertEvaluator{Type: typ}
		evaluator.Threshold, _ = firstParam.Float64()
		return evaluator, nil
	} else if stringInSlice(typ, rangedTypes) {
		secondParam, ok := params[1].(json.Number)
		if !ok {
			return nil, alerting.ValidationError{Reason: "Evaluator has invalid threshold parameter"}
		}

		evaluator := &RangedAlertEvaluator{Type: typ}
		evaluator.Lower, _ = firstParam.Float64()
		evaluator.Upper, _ = secondParam.Float64()
		return evaluator, nil
	}

	return nil, alerting.ValidationError{Reason: "Evaludator invalid evaluator type"}
}

func stringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}
