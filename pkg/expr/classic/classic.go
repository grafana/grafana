package classic

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// ConditionsCmd is command for the classic conditions
// expression operation.
type ConditionsCmd struct {
	Conditions []condition
	refID      string
}

// ClassicConditionJSON is the JSON model for a single condition.
// It is based on services/alerting/conditions/query.go's newQueryCondition().
type ClassicConditionJSON struct {
	Evaluator ConditionEvalJSON `json:"evaluator"`

	Operator struct {
		Type string `json:"type"`
	} `json:"operator"`

	Query struct {
		Params []string `json:"params"`
	} `json:"query"`

	Reducer struct {
		// Params []interface{} `json:"params"` (Unused)
		Type string `json:"type"`
	} `json:"reducer"`
}

type ConditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
}

// condition is a single condition within the ConditionsCmd.
type condition struct {
	QueryRefID string
	Reducer    classicReducer
	Evaluator  evaluator
	Operator   string
}

type classicReducer string

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (ccc *ConditionsCmd) NeedsVars() []string {
	vars := []string{}
	for _, c := range ccc.Conditions {
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
func (ccc *ConditionsCmd) Execute(ctx context.Context, vars mathexp.Vars) (mathexp.Results, error) {
	firing := true
	newRes := mathexp.Results{}
	noDataFound := true

	matches := []EvalMatch{}

	for i, c := range ccc.Conditions {
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

// UnmarshalConditionsCmd creates a new ConditionsCmd.
func UnmarshalConditionsCmd(rawQuery map[string]interface{}, refID string) (*ConditionsCmd, error) {
	jsonFromM, err := json.Marshal(rawQuery["conditions"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal classic condition body: %w", err)
	}
	var ccj []ClassicConditionJSON
	if err = json.Unmarshal(jsonFromM, &ccj); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled classic condition body: %w", err)
	}

	c := &ConditionsCmd{
		refID: refID,
	}

	for i, cj := range ccj {
		cond := condition{}

		if i > 0 && cj.Operator.Type != "and" && cj.Operator.Type != "or" {
			return nil, fmt.Errorf("classic condition %v operator must be `and` or `or`", i+1)
		}
		cond.Operator = cj.Operator.Type

		if len(cj.Query.Params) == 0 || cj.Query.Params[0] == "" {
			return nil, fmt.Errorf("classic condition %v is missing the query refID argument", i+1)
		}

		cond.QueryRefID = cj.Query.Params[0]

		cond.Reducer = classicReducer(cj.Reducer.Type)
		if !cond.Reducer.ValidReduceFunc() {
			return nil, fmt.Errorf("reducer '%v' in condition %v is not a valid reducer", cond.Reducer, i+1)
		}

		cond.Evaluator, err = newAlertEvaluator(cj.Evaluator)
		if err != nil {
			return nil, err
		}

		c.Conditions = append(c.Conditions, cond)
	}

	return c, nil
}
