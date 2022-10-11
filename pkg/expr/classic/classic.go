package classic

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// ClassicConditionsCmd is a command that supports the reduction and comparison of conditions.
//
// A condition in ClassicConditionsCmd can reduce a time series; or contain either an instant metric
// or the result of another expression; and check if it exceeds a threshold, falls within a
// range, or does not contain a value.
//
// If ClassicConditionsCmd contains more than one condition, it reduces the boolean outcomes of the
// threshold, range or value checks using the logical operator of the right hand side condition
// until all conditions have been reduced to a single boolean outcome. ClassicConditionsCmd does not
// follow operator precedence.
//
// For example if we have the following classic condition:
//
//     min(A) > 5 OR max(B) < 10 AND C = 1
//
// which reduces to the following boolean outcomes:
//
//     false OR true AND true
//
// then the outcome of ClassicConditionsCmd is true.
//
type ClassicConditionsCmd struct {
	Conditions []condition
	refID      string
}

// condition is a single condition in ClassicConditionsCmd.
type condition struct {
	QueryRefID string
	Reducer    classicReducer
	Evaluator  evaluator
	Operator   string
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (cmd *ClassicConditionsCmd) NeedsVars() []string {
	vars := []string{}
	for _, c := range cmd.Conditions {
		vars = append(vars, c.QueryRefID)
	}
	return vars
}

// EvalMatch represents the series violating the threshold.
// It goes into the metadata of data frames so it can be extracted.
type EvalMatch struct {
	Value  *float64    `json:"value"`
	Metric string      `json:"metric"`
	Labels data.Labels `json:"labels"`
}

func (em EvalMatch) MarshalJSON() ([]byte, error) {
	fs := ""
	if em.Value != nil {
		fs = strconv.FormatFloat(*em.Value, 'f', -1, 64)
	}
	return json.Marshal(struct {
		Value  string      `json:"value"`
		Metric string      `json:"metric"`
		Labels data.Labels `json:"labels"`
	}{
		fs,
		em.Metric,
		em.Labels,
	})
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (cmd *ClassicConditionsCmd) Execute(_ context.Context, vars mathexp.Vars) (mathexp.Results, error) {
	firing := true
	newRes := mathexp.Results{}
	noDataFound := true

	matches := []EvalMatch{}

	for i, c := range cmd.Conditions {
		querySeriesSet := vars[c.QueryRefID]
		nilReducedCount := 0
		firingCount := 0
		for _, val := range querySeriesSet.Values {
			var reducedNum mathexp.Number
			var name string
			switch v := val.(type) {
			case mathexp.Series:
				reducedNum = c.Reducer.Reduce(v)
				name = v.GetName()
			case mathexp.Number:
				reducedNum = v
				if len(v.Frame.Fields) > 0 {
					name = v.Frame.Fields[0].Name
				}
			default:
				return newRes, fmt.Errorf("can only reduce type series, got type %v", val.Type())
			}

			// TODO handle error / no data signals
			thisCondNoDataFound := reducedNum.GetFloat64Value() == nil

			if thisCondNoDataFound {
				nilReducedCount++
			}

			evalRes := c.Evaluator.Eval(reducedNum)

			if evalRes {
				match := EvalMatch{
					Value:  reducedNum.GetFloat64Value(),
					Metric: name,
				}
				if reducedNum.GetLabels() != nil {
					match.Labels = reducedNum.GetLabels().Copy()
				}
				matches = append(matches, match)
				firingCount++
			}
		}

		thisCondFiring := firingCount > 0
		thisCondNoData := len(querySeriesSet.Values) == nilReducedCount

		if i == 0 {
			firing = thisCondFiring
			noDataFound = thisCondNoData
		}

		if c.Operator == "or" {
			firing = firing || thisCondFiring
			noDataFound = noDataFound || thisCondNoData
		} else {
			firing = firing && thisCondFiring
			noDataFound = noDataFound && thisCondNoData
		}

		if thisCondNoData {
			matches = append(matches, EvalMatch{
				Metric: "NoData",
			})
			noDataFound = true
		}

		firingCount = 0
		nilReducedCount = 0
	}

	num := mathexp.NewNumber("", nil)

	num.SetMeta(matches)

	var v float64
	switch {
	case noDataFound:
		num.SetValue(nil)
	case firing:
		v = 1
		num.SetValue(&v)
	case !firing:
		num.SetValue(&v)
	}

	newRes.Values = append(newRes.Values, num)

	return newRes, nil
}

// ConditionJSON is the JSON model for a single condition in ClassicConditionsCmd.
// It is based on services/alerting/conditions/query.go's newQueryCondition().
type ConditionJSON struct {
	Evaluator ConditionEvalJSON     `json:"evaluator"`
	Operator  ConditionOperatorJSON `json:"operator"`
	Query     ConditionQueryJSON    `json:"query"`
	Reducer   ConditionReducerJSON  `json:"reducer"`
	// Params []interface{} `json:"params"` (Unused)
}

type ConditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
}

type ConditionOperatorJSON struct {
	Type string `json:"type"`
}

type ConditionQueryJSON struct {
	Params []string `json:"params"`
}

type ConditionReducerJSON struct {
	Type string `json:"type"`
}

// UnmarshalConditionsCmd creates a new ClassicConditionsCmd.
func UnmarshalConditionsCmd(rawQuery map[string]interface{}, refID string) (*ClassicConditionsCmd, error) {
	jsonFromM, err := json.Marshal(rawQuery["conditions"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal classic condition body: %w", err)
	}
	var ccj []ConditionJSON
	if err = json.Unmarshal(jsonFromM, &ccj); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled classic condition body: %w", err)
	}

	c := &ClassicConditionsCmd{
		refID: refID,
	}

	for i, cj := range ccj {
		cond := condition{}

		if i > 0 && cj.Operator.Type != "and" && cj.Operator.Type != "or" {
			return nil, fmt.Errorf("condition %v operator must be `and` or `or`", i+1)
		}
		cond.Operator = cj.Operator.Type

		if len(cj.Query.Params) == 0 || cj.Query.Params[0] == "" {
			return nil, fmt.Errorf("condition %v is missing the query refID argument", i+1)
		}

		cond.QueryRefID = cj.Query.Params[0]

		cond.Reducer = classicReducer(cj.Reducer.Type)
		if !cond.Reducer.ValidReduceFunc() {
			return nil, fmt.Errorf("invalid reducer '%v' in condition %v", cond.Reducer, i+1)
		}

		cond.Evaluator, err = newAlertEvaluator(cj.Evaluator)
		if err != nil {
			return nil, err
		}

		c.Conditions = append(c.Conditions, cond)
	}

	return c, nil
}
