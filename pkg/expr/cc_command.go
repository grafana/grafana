package expr

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// ClassicConditionsCommand is command for the classic conditions
// expression operation.
type ClassicConditionsCommand struct {
	Conditions []ClassicCondition
	refID      string
}

// classicConditionJSON is the JSON model for a single condition.
// It is based on services/alerting/conditions/query.go's newQueryCondition().
type classicConditionJSON struct {
	Evaluator struct {
		Params []float64 `json:"params"`
		Type   string    `json:"type"` // e.g. "gt"
	} `json:"evaluator"`

	Operator struct {
		Type string `json:"type"`
	} `json:"operator"`

	Query struct {
		Params []string
	} `json:"query"`

	Reducer struct {
		Params []interface{} `json:"params"`
		Type   string        `json:"type"`
	}
}

// ClassicCondition is a single condition within the ClassicConditionsCommand.
type ClassicCondition struct {
	QueryRefID string
	Reducer    classicReducer
	Evaluator  classicEvaluator
	Operator   string
}

type classicReducer string

type classicEvaluator string

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (ccc *ClassicConditionsCommand) NeedsVars() []string {
	vars := []string{}
	for _, c := range ccc.Conditions {
		vars = append(vars, c.QueryRefID)
	}
	return vars
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (ccc *ClassicConditionsCommand) Execute(ctx context.Context, vars mathexp.Vars) (mathexp.Results, error) {
	return mathexp.Results{}, fmt.Errorf("classic conditions not implemented yet")
}
