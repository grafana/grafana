package classic

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// ConditionsCmd is a command that supports the reduction and comparison of conditions.
//
// A condition in ConditionsCmd can reduce a time series, contain an instant metric, or the
// result of another expression; and checks if it exceeds a threshold, falls within a range,
// or does not contain a value.
//
// If ConditionsCmd contains more than one condition, it reduces the boolean outcomes of the
// threshold, range or value checks using the logical operator of the right hand side condition
// until all conditions have been reduced to a single boolean outcome. ConditionsCmd does not
// follow operator precedence.
//
// For example if we have the following classic condition:
//
//	min(A) > 5 OR max(B) < 10 AND C = 1
//
// which reduces to the following boolean outcomes:
//
//	false OR true AND true
//
// then the outcome of ConditionsCmd is true.
type ConditionsCmd struct {
	Conditions []condition
	RefID      string
}

// condition is a single condition in ConditionsCmd.
type condition struct {
	InputRefID string

	// Reducer reduces a series of data into a single result. An example of a reducer is the avg,
	// min and max functions.
	Reducer reducer

	// Evaluator evaluates the reduced time series, instant metric, or result of another expression
	// against an evaluator. An example of an evaluator is checking if it exceeds a threshold,
	// falls within a range, or does not contain a value.
	Evaluator evaluator

	// Operator is the logical operator to use when there are two conditions in ConditionsCmd.
	// If there are more than two conditions in ConditionsCmd then operator is used to compare
	// the outcome of this condition with that of the condition before it.
	Operator string
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (cmd *ConditionsCmd) NeedsVars() []string {
	vars := []string{}
	for _, c := range cmd.Conditions {
		vars = append(vars, c.InputRefID)
	}
	return vars
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (cmd *ConditionsCmd) Execute(_ context.Context, _ time.Time, vars mathexp.Vars) (mathexp.Results, error) {
	// isFiring and isNoData tracks whether ConditionsCmd is firing or no data
	var isFiring, isNoData bool
	var res mathexp.Results

	matches := make([]EvalMatch, 0)
	for ix, cond := range cmd.Conditions {
		// isCondFiring and isCondNoData tracks whether the condition is firing or no data
		//
		// There are a number of reasons a condition can have no data:
		//
		//  1. The input data vars[cond.InputRefID] has no values
		//  2. The input data has one or more values, however all are mathexp.NoData
		//  3. The input data has one or more values of mathexp.Number or mathexp.Series,
		//     however the either all mathexp.Number have a nil float64 or the reduce function
		//     for all mathexp.Series returns a mathexp.Number with a nil float64
		//  4. The input data is a combination of all mathexp.NoData, mathexp.Number with a nil
		//     float64, or mathexp.Series that reduce to a nil float64
		var isCondFiring, isCondNoData bool
		var numSeriesNoData int

		series := vars[cond.InputRefID]
		for _, value := range series.Values {
			var (
				name   string
				number mathexp.Number
			)
			switch v := value.(type) {
			case mathexp.NoData:
				// Reduce expressions return v.New(), however classic conditions use the operator
				// in the condition to determine if the outcome of ConditionsCmd is no data.
				// To keep this code as simple as possible we translate mathexp.NoData into a
				// mathexp.Number with a nil value so number.GetFloat64Value() returns nil
				number = mathexp.NewNumber("no data", nil)
				number.SetValue(nil)
			case mathexp.Number:
				if len(v.Frame.Fields) > 0 {
					name = v.Frame.Fields[0].Name
				}
				number = v
			case mathexp.Series:
				name = v.GetName()
				number = cond.Reducer.Reduce(v)
			default:
				return res, fmt.Errorf("can only reduce type series, got type %v", v.Type())
			}

			// Check if the value was either a mathexp.NoData, a mathexp.Number with a nil float64,
			// or mathexp.Series that reduced to a nil float64
			if number.GetFloat64Value() == nil {
				numSeriesNoData += 1
			} else if ok := cond.Evaluator.Eval(number); ok {
				isCondFiring = true
				// If the condition is met then add it to the list of matching conditions
				labels := number.GetLabels()
				if labels != nil {
					labels = labels.Copy()
				}
				matches = append(matches, EvalMatch{
					Metric: name,
					Value:  number.GetFloat64Value(),
					Labels: labels,
				})
			}
		}

		// The condition is no data iff all the input data is a combination of all mathexp.NoData,
		// mathexp.Number with a nil loat64, or mathexp.Series that reduce to a nil float64
		isCondNoData = numSeriesNoData == len(series.Values)
		if isCondNoData {
			matches = append(matches, EvalMatch{
				Metric: "NoData",
			})
		}

		if ix == 0 {
			isFiring = isCondFiring
			isNoData = isCondNoData
		} else if cond.Operator == "or" {
			isFiring = isFiring || isCondFiring
			isNoData = isNoData || isCondNoData
		} else {
			isFiring = isFiring && isCondFiring
			isNoData = isNoData && isCondNoData
		}
	}

	var v float64
	number := mathexp.NewNumber("", nil)
	number.SetMeta(matches)
	if isFiring {
		v = 1
		number.SetValue(&v)
	} else if isNoData {
		number.SetValue(nil)
	} else {
		number.SetValue(&v)
	}

	res.Values = append(res.Values, number)
	return res, nil
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

// ConditionJSON is the JSON model for a single condition in ConditionsCmd.
// It is based on services/alerting/conditions/query.go's newQueryCondition().
type ConditionJSON struct {
	Evaluator ConditionEvalJSON     `json:"evaluator"`
	Operator  ConditionOperatorJSON `json:"operator"`
	Query     ConditionQueryJSON    `json:"query"`
	Reducer   ConditionReducerJSON  `json:"reducer"`
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
	// Params []interface{} `json:"params"` (Unused)
}

// UnmarshalConditionsCmd creates a new ConditionsCmd.
func UnmarshalConditionsCmd(rawQuery map[string]interface{}, refID string) (*ConditionsCmd, error) {
	jsonFromM, err := json.Marshal(rawQuery["conditions"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal classic condition body: %w", err)
	}
	var ccj []ConditionJSON
	if err = json.Unmarshal(jsonFromM, &ccj); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled classic condition body: %w", err)
	}

	c := &ConditionsCmd{
		RefID: refID,
	}

	for i, cj := range ccj {
		cond := condition{}

		if i > 0 && cj.Operator.Type != "and" && cj.Operator.Type != "or" {
			return nil, fmt.Errorf("condition %v operator must be `and` or `or`", i+1)
		}
		cond.Operator = cj.Operator.Type

		if len(cj.Query.Params) == 0 || cj.Query.Params[0] == "" {
			return nil, fmt.Errorf("condition %v is missing the query RefID argument", i+1)
		}

		cond.InputRefID = cj.Query.Params[0]

		cond.Reducer = reducer(cj.Reducer.Type)
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
