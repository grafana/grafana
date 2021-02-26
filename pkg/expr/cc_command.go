package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// prefixing everything with classic may suggest another package :P

// ClassicConditionsCmd is command for the classic conditions
// expression operation.
type ClassicConditionsCmd struct {
	Conditions []ClassicCondition
	refID      string
}

// classicConditionJSON is the JSON model for a single condition.
// It is based on services/alerting/conditions/query.go's newQueryCondition().
type classicConditionJSON struct {
	Evaluator classicConditionEvalJSON `json:"evaluator"`

	Operator struct {
		Type string `json:"type"`
	} `json:"operator"`

	Query struct {
		Params []string
	} `json:"query"`

	Reducer struct {
		// Params []interface{} `json:"params"` (Unused)
		Type string `json:"type"`
	}
}

type classicConditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"

}

// ClassicCondition is a single condition within the ClassicConditionsCommand.
type ClassicCondition struct {
	QueryRefID string
	Reducer    classicReducer
	Evaluator  classicEvaluator
	Operator   string
}

type classicReducer string

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (ccc *ClassicConditionsCmd) NeedsVars() []string {
	vars := []string{}
	for _, c := range ccc.Conditions {
		vars = append(vars, c.QueryRefID)
	}
	return vars
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (ccc *ClassicConditionsCmd) Execute(ctx context.Context, vars mathexp.Vars) (mathexp.Results, error) {
	firing := true
	newRes := mathexp.Results{}

	for i, c := range ccc.Conditions {
		querySeriesSet := vars[c.QueryRefID]
		for _, val := range querySeriesSet.Values {
			series, ok := val.(mathexp.Series)
			if !ok {
				return newRes, fmt.Errorf("can only reduce type series, got type %v", val.Type())
			}

			reducedNum := c.Reducer.Reduce(series)
			// TODO handle error / no data signals
			evalRes := c.Evaluator.Eval(reducedNum)

			if i == 0 {
				firing = evalRes
				//noDataFound = cr.NoDataFound
			}

			if c.Operator == "or" {
				firing = firing || evalRes
			} else {
				firing = firing && evalRes
			}
		}
	}

	num := mathexp.NewNumber("", nil)

	var v float64
	if firing {
		v = 1
	}

	num.SetValue(&v)

	newRes.Values = append(newRes.Values, num)

	return newRes, nil
}

// UnmarshalClassicConditionsCmd creates a new ClassicConditionsCmd.
func UnmarshalClassicConditionsCmd(rn *rawNode) (*ClassicConditionsCmd, error) {
	jsonFromM, err := json.Marshal(rn.Query["conditions"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal classic condition body: %w", err)
	}
	var ccj []classicConditionJSON
	if err = json.Unmarshal(jsonFromM, &ccj); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled classic condition body: %w", err)
	}

	c := &ClassicConditionsCmd{
		refID: rn.RefID,
	}

	for i, cj := range ccj {
		cond := ClassicCondition{}

		if len(cj.Query.Params) == 0 || cj.Query.Params[0] == "" {
			return nil, fmt.Errorf("classic condition %v is missing the query refID argument", i+1)
		}

		cond.QueryRefID = cj.Query.Params[0]

		cond.Reducer = classicReducer(cj.Reducer.Type)
		if !cond.Reducer.ValidReduceFunc() {
			return nil, fmt.Errorf("reducer '%v' in condition %v is not a valid reducer", cond.Reducer, i+1)
		}

		cond.Evaluator, err = newClassicAlertEvaluator(cj.Evaluator)
		if err != nil {
			return nil, err
		}

		c.Conditions = append(c.Conditions, cond)
	}

	spew.Dump(c)
	return c, nil
}

func (cr classicReducer) ValidReduceFunc() bool {
	switch cr {
	case "avg", "sum", "min", "max", "count", "last", "median":
		return true
	case "diff", "diff_abs", "percent_diff", "percent_diff_abs", "count_not_null":
		return true
	}
	return false
}

type classicEvaluator interface {
	Eval(mathexp.Number) bool
}

type classicNoValueEvaluator struct{}

type classicThresholdEvaluator struct {
	Type      string
	Threshold float64
}

type classicRangedEvaluator struct {
	Type  string
	Lower float64
	Upper float64
}

// newClassicAlertEvaluator is a factory function for returning
// an `AlertEvaluator` depending on evalution operator.
func newClassicAlertEvaluator(model classicConditionEvalJSON) (classicEvaluator, error) {
	switch model.Type {
	case "gt", "lt":
		return newClassicThresholdEvaluator(model)
	case "within_range", "outside_range":
		return newClassicRangedEvaluator(model)
	case "no_value":
		return &classicNoValueEvaluator{}, nil
	}

	return nil, fmt.Errorf("evaluator invalid evaluator type: %s", model.Type)
}

func (e *classicThresholdEvaluator) Eval(reducedValue mathexp.Number) bool {
	fv := reducedValue.GetFloat64Value()
	if fv == nil {
		return false
	}

	switch e.Type {
	case "gt":
		return *fv > e.Threshold
	case "lt":
		return *fv < e.Threshold
	}

	return false
}

func newClassicThresholdEvaluator(model classicConditionEvalJSON) (*classicThresholdEvaluator, error) {
	if len(model.Params) == 0 {
		return nil, fmt.Errorf("evaluator '%v' is missing the threshold parameter", model.Type)
	}

	return &classicThresholdEvaluator{
		Type:      model.Type,
		Threshold: model.Params[0],
	}, nil
}

func (e *classicNoValueEvaluator) Eval(reducedValue mathexp.Number) bool {
	return !(reducedValue.GetFloat64Value() == nil)
}

func newClassicRangedEvaluator(model classicConditionEvalJSON) (*classicRangedEvaluator, error) {
	if len(model.Params) != 2 {
		return nil, fmt.Errorf("ranged evaluator requires 2 parameters")
	}

	return &classicRangedEvaluator{
		Type:  model.Type,
		Lower: model.Params[0],
		Upper: model.Params[1],
	}, nil
}

func (e *classicRangedEvaluator) Eval(reducedValue mathexp.Number) bool {
	fv := reducedValue.GetFloat64Value()
	if fv == nil {
		return false
	}

	switch e.Type {
	case "within_range":
		return (e.Lower < *fv && e.Upper > *fv) || (e.Upper < *fv && e.Lower > *fv)
	case "outside_range":
		return (e.Upper < *fv && e.Lower < *fv) || (e.Upper > *fv && e.Lower > *fv)
	}

	return false
}

func nilOrNaN(f *float64) bool {
	return f == nil || math.IsNaN(*f)
}

//nolint: gocyclo
func (cr classicReducer) Reduce(series mathexp.Series) mathexp.Number {
	num := mathexp.NewNumber("", nil)
	num.SetValue(nil)

	if series.Len() == 0 {
		return num
	}

	value := float64(0)
	allNull := true

	vF := series.Frame.Fields[series.ValueIdx]

	switch cr {
	case "avg":
		validPointsCount := 0
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if nilOrNaN(f) {
					continue
				}
				value += *f
				validPointsCount++
				allNull = false
			}
		}
		if validPointsCount > 0 {
			value /= float64(validPointsCount)
		}
	case "sum":
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if nilOrNaN(f) {
					continue
				}
				value += *f
			}
		}
	case "min":
		value = math.MaxFloat64
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if nilOrNaN(f) {
					continue
				}
				if value > *f {
					value = *f
				}
			}
		}
	case "max":
		value = -math.MaxFloat64
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if nilOrNaN(f) {
					continue
				}
				if value < *f {
					value = *f
				}
			}
		}
	case "count":
		value = float64(vF.Len())
		allNull = false
	case "last":
		for i := vF.Len() - 1; i >= 0; i-- {
			if f, ok := vF.At(i).(*float64); ok {
				if !nilOrNaN(f) {
					value = *f
					allNull = false
					break
				}
			}
		}
	case "median":
		var values []float64
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if nilOrNaN(f) {
					continue
				}
				allNull = false
				values = append(values, *f)
			}
		}
		if len(values) >= 1 {
			sort.Float64s(values)
			length := len(values)
			if length%2 == 1 {
				value = values[(length-1)/2]
			} else {
				value = (values[(length/2)-1] + values[length/2]) / 2
			}
		}
	case "diff":
		allNull, value = calculateDiff(vF, allNull, value, diff)
	case "diff_abs":
		allNull, value = calculateDiff(vF, allNull, value, diffAbs)
	case "percent_diff":
		allNull, value = calculateDiff(vF, allNull, value, percentDiff)
	case "percent_diff_abs":
		allNull, value = calculateDiff(vF, allNull, value, percentDiffAbs)
	case "count_non_null":
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if nilOrNaN(f) {
					continue
				}
				value++
			}
		}

		if value > 0 {
			allNull = false
		}
	}

	if allNull {
		return num
	}

	num.SetValue(&value)
	return num
}

func calculateDiff(vF *data.Field, allNull bool, value float64, fn func(float64, float64) float64) (bool, float64) {
	var (
		first float64
		i     int
	)
	// get the newest point
	for i = vF.Len() - 1; i >= 0; i-- {
		if f, ok := vF.At(i).(*float64); ok {
			if !nilOrNaN(f) {
				first = *f
				allNull = false
				break
			}
		}
	}
	if i >= 1 {
		// get the oldest point
		for i := 0; i < vF.Len(); i++ {
			if f, ok := vF.At(i).(*float64); ok {
				if !nilOrNaN(f) {
					value = fn(first, *f)
					allNull = false
					break
				}
			}
		}
	}
	return allNull, value
}

var diff = func(newest, oldest float64) float64 {
	return newest - oldest
}

var diffAbs = func(newest, oldest float64) float64 {
	return math.Abs(newest - oldest)
}

var percentDiff = func(newest, oldest float64) float64 {
	return (newest - oldest) / math.Abs(oldest) * 100
}

var percentDiffAbs = func(newest, oldest float64) float64 {
	return math.Abs((newest - oldest) / oldest * 100)
}
