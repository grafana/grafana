package alerting

import "github.com/grafana/grafana/pkg/components/simplejson"

type AlertCondition interface {
	Eval()
}

type QueryCondition struct {
	Query     AlertQuery
	Reducer   AlertReducerModel
	Evaluator AlertEvaluatorModel
}

func (c *QueryCondition) Eval() {
}

type AlertReducerModel struct {
	Type   string
	Params []interface{}
}

type AlertEvaluatorModel struct {
	Type   string
	Params []interface{}
}

func NewQueryCondition(model *simplejson.Json) (*QueryCondition, error) {
	condition := QueryCondition{}

	return &condition, nil
}
