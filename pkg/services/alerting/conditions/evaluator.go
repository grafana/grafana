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
	case ">":
		return reducedValue > e.Threshold
	case "<":
		return reducedValue < e.Threshold
	}

	return false
}

func NewDefaultAlertEvaluator(model *simplejson.Json) (*DefaultAlertEvaluator, error) {
	evaluator := &DefaultAlertEvaluator{}

	evaluator.Type = model.Get("type").MustString()
	if evaluator.Type == "" {
		return nil, alerting.AlertValidationError{Reason: "Evaluator missing type property"}
	}

	params := model.Get("params").MustArray()
	if len(params) == 0 {
		return nil, alerting.AlertValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	threshold, ok := params[0].(json.Number)
	if !ok {
		return nil, alerting.AlertValidationError{Reason: "Evaluator has invalid threshold parameter"}
	}

	evaluator.Threshold, _ = threshold.Float64()
	return evaluator, nil
}
