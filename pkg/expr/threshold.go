package expr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

type predicate interface {
	Eval(f float64) bool
}

type ThresholdCommand struct {
	ReferenceVar  string
	RefID         string
	ThresholdFunc ThresholdType
	Invert        bool
	predicate     predicate
}

// +enum
type ThresholdType string

const (
	ThresholdIsAbove                ThresholdType = "gt"
	ThresholdIsBelow                ThresholdType = "lt"
	ThresholdIsEqual                ThresholdType = "eq"
	ThresholdIsNotEqual             ThresholdType = "ne"
	ThresholdIsGreaterThanEqual     ThresholdType = "gte"
	ThresholdIsLessThanEqual        ThresholdType = "lte"
	ThresholdIsWithinRange          ThresholdType = "within_range"
	ThresholdIsOutsideRange         ThresholdType = "outside_range"
	ThresholdIsWithinRangeIncluded  ThresholdType = "within_range_included"
	ThresholdIsOutsideRangeIncluded ThresholdType = "outside_range_included"
)

var (
	supportedThresholdFuncs = []string{
		string(ThresholdIsAbove),
		string(ThresholdIsBelow),
		string(ThresholdIsEqual),
		string(ThresholdIsNotEqual),
		string(ThresholdIsGreaterThanEqual),
		string(ThresholdIsLessThanEqual),
		string(ThresholdIsWithinRange),
		string(ThresholdIsOutsideRange),
		string(ThresholdIsWithinRangeIncluded),
		string(ThresholdIsOutsideRangeIncluded),
	}
)

func NewThresholdCommand(refID, referenceVar string, thresholdFunc ThresholdType, conditions []float64) (*ThresholdCommand, error) {
	var predicate predicate
	switch thresholdFunc {
	case ThresholdIsOutsideRange:
		if len(conditions) < 2 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 2", thresholdFunc, len(conditions))
		}
		predicate = outsideRangePredicate{left: conditions[0], right: conditions[1]}
	case ThresholdIsWithinRange:
		if len(conditions) < 2 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 2", thresholdFunc, len(conditions))
		}
		predicate = withinRangePredicate{left: conditions[0], right: conditions[1]}
	case ThresholdIsWithinRangeIncluded:
		if len(conditions) < 2 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 2", thresholdFunc, len(conditions))
		}
		predicate = withinRangeIncludedPredicate{left: conditions[0], right: conditions[1]}
	case ThresholdIsOutsideRangeIncluded:
		if len(conditions) < 2 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 2", thresholdFunc, len(conditions))
		}
		predicate = outsideRangeIncludedPredicate{left: conditions[0], right: conditions[1]}
	case ThresholdIsAbove:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 1", thresholdFunc, len(conditions))
		}
		predicate = greaterThanPredicate{value: conditions[0]}
	case ThresholdIsBelow:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 1", thresholdFunc, len(conditions))
		}
		predicate = lessThanPredicate{value: conditions[0]}
	case ThresholdIsEqual:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 1", thresholdFunc, len(conditions))
		}
		predicate = equalPredicate{value: conditions[0]}
	case ThresholdIsNotEqual:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 1", thresholdFunc, len(conditions))
		}
		predicate = notEqualPredicate{value: conditions[0]}
	case ThresholdIsGreaterThanEqual:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 1", thresholdFunc, len(conditions))
		}
		predicate = greaterThanEqualPredicate{value: conditions[0]}
	case ThresholdIsLessThanEqual:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments for threshold function '%s': got %d but need 1", thresholdFunc, len(conditions))
		}
		predicate = lessThanEqualPredicate{value: conditions[0]}
	default:
		return nil, fmt.Errorf("expected threshold function to be one of [%s], got %s", strings.Join(supportedThresholdFuncs, ", "), thresholdFunc)
	}

	return &ThresholdCommand{
		RefID:         refID,
		ReferenceVar:  referenceVar,
		ThresholdFunc: thresholdFunc,
		predicate:     predicate,
	}, nil
}

type ConditionEvalJSON struct {
	Params []float64     `json:"params"`
	Type   ThresholdType `json:"type"` // e.g. "gt"
}

// UnmarshalResampleCommand creates a ResampleCMD from Grafana's frontend query.
func UnmarshalThresholdCommand(rn *rawNode, features featuremgmt.FeatureToggles) (Command, error) {
	cmdConfig := ThresholdCommandConfig{}
	if err := json.Unmarshal(rn.QueryRaw, &cmdConfig); err != nil {
		return nil, fmt.Errorf("failed to parse the threshold command: %w", err)
	}
	if cmdConfig.Expression == "" {
		return nil, fmt.Errorf("no variable specified to reference for refId %v", rn.RefID)
	}
	referenceVar := cmdConfig.Expression

	// we only support one condition for now, we might want to turn this in to "OR" expressions later
	if len(cmdConfig.Conditions) != 1 {
		return nil, fmt.Errorf("threshold expression requires exactly one condition")
	}
	firstCondition := cmdConfig.Conditions[0]

	threshold, err := NewThresholdCommand(rn.RefID, referenceVar, firstCondition.Evaluator.Type, firstCondition.Evaluator.Params)
	if err != nil {
		return nil, fmt.Errorf("invalid condition: %w", err)
	}
	if firstCondition.UnloadEvaluator != nil && features.IsEnabledGlobally(featuremgmt.FlagRecoveryThreshold) {
		unloading, err := NewThresholdCommand(rn.RefID, referenceVar, firstCondition.UnloadEvaluator.Type, firstCondition.UnloadEvaluator.Params)
		if err != nil {
			return nil, fmt.Errorf("invalid unloadCondition: %w", err)
		}
		unloading.Invert = true
		var d Fingerprints
		if firstCondition.LoadedDimensions != nil {
			d, err = FingerprintsFromFrame(firstCondition.LoadedDimensions)
			if err != nil {
				return nil, fmt.Errorf("failed to parse loaded dimensions: %w", err)
			}
		}
		return NewHysteresisCommand(rn.RefID, referenceVar, *threshold, *unloading, d)
	}
	return threshold, nil
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (tc *ThresholdCommand) NeedsVars() []string {
	return []string{tc.ReferenceVar}
}

func (tc *ThresholdCommand) Execute(_ context.Context, _ time.Time, vars mathexp.Vars, _ tracing.Tracer) (mathexp.Results, error) {
	eval := func(maybeValue *float64) *float64 {
		if maybeValue == nil {
			return nil
		}
		result := tc.predicate.Eval(*maybeValue)
		if tc.Invert {
			result = !result
		}
		if result {
			return util.Pointer(float64(1))
		}
		return util.Pointer(float64(0))
	}

	refVarResult := vars[tc.ReferenceVar]
	newRes := mathexp.Results{Values: make(mathexp.Values, 0, len(refVarResult.Values))}
	for _, val := range refVarResult.Values {
		switch v := val.(type) {
		case mathexp.Series:
			s := mathexp.NewSeries(tc.RefID, v.GetLabels(), v.Len())
			for i := 0; i < v.Len(); i++ {
				t, value := v.GetPoint(i)
				s.SetPoint(i, t, eval(value))
			}
			newRes.Values = append(newRes.Values, s)
		case mathexp.Number:
			copyV := mathexp.NewNumber(tc.RefID, v.GetLabels())
			copyV.SetValue(eval(v.GetFloat64Value()))
			newRes.Values = append(newRes.Values, copyV)
		case mathexp.Scalar:
			copyV := mathexp.NewScalar(tc.RefID, eval(v.GetFloat64Value()))
			newRes.Values = append(newRes.Values, copyV)
		case mathexp.NoData:
			newRes.Values = append(newRes.Values, mathexp.NewNoData())
		default:
			return newRes, fmt.Errorf("unsupported format of the input data, got type %v", val.Type())
		}
	}
	return newRes, nil
}

func (tc *ThresholdCommand) Type() string {
	return TypeThreshold.String()
}
func IsSupportedThresholdFunc(name string) bool {
	isSupported := false

	for _, funcName := range supportedThresholdFuncs {
		if funcName == name {
			isSupported = true
		}
	}

	return isSupported
}

type ThresholdCommandConfig struct {
	Expression string                   `json:"expression"`
	Conditions []ThresholdConditionJSON `json:"conditions"`
}

type ThresholdConditionJSON struct {
	Evaluator        ConditionEvalJSON  `json:"evaluator"`
	UnloadEvaluator  *ConditionEvalJSON `json:"unloadEvaluator,omitempty"`
	LoadedDimensions *data.Frame        `json:"loadedDimensions,omitempty"`
}

// IsHysteresisExpression returns true if the raw model describes a hysteresis command:
// - field 'type' has value "threshold",
// - field 'conditions' is array of objects and has exactly one element
// - field 'conditions[0].unloadEvaluator is not nil
func IsHysteresisExpression(query map[string]any) bool {
	c, err := getConditionForHysteresisCommand(query)
	if err != nil {
		return false
	}
	return c != nil
}

// SetLoadedDimensionsToHysteresisCommand mutates the input map and sets field "conditions[0].loadedMetrics" with the data frame created from the provided fingerprints.
func SetLoadedDimensionsToHysteresisCommand(query map[string]any, fingerprints Fingerprints) error {
	condition, err := getConditionForHysteresisCommand(query)
	if err != nil {
		return err
	}
	if condition == nil {
		return errors.New("not a hysteresis command")
	}
	fr := FingerprintsToFrame(fingerprints)
	condition["loadedDimensions"] = fr
	return nil
}

func getConditionForHysteresisCommand(query map[string]any) (map[string]any, error) {
	t, err := GetExpressionCommandType(query)
	if err != nil {
		return nil, err
	}
	if t != TypeThreshold {
		return nil, errors.New("not a threshold command")
	}

	c, ok := query["conditions"]
	if !ok {
		return nil, errors.New("invalid threshold command: expected field \"condition\"")
	}
	var condition map[string]any
	switch arr := c.(type) {
	case []any:
		if len(arr) != 1 {
			return nil, errors.New("invalid threshold command: field \"condition\" expected to have exactly 1 field")
		}
		switch m := arr[0].(type) {
		case map[string]any:
			condition = m
		default:
			return nil, errors.New("invalid threshold command: value of the first element of field \"condition\" expected to be an object")
		}
	default:
		return nil, errors.New("invalid threshold command: field \"condition\" expected to be an array of objects")
	}
	_, ok = condition["unloadEvaluator"]
	if !ok {
		return nil, nil
	}
	return condition, nil
}

type withinRangePredicate struct {
	left  float64
	right float64
}

func (r withinRangePredicate) Eval(f float64) bool {
	return f > r.left && f < r.right
}

type outsideRangePredicate struct {
	left  float64
	right float64
}

func (r outsideRangePredicate) Eval(f float64) bool {
	return f < r.left || f > r.right
}

type withinRangeIncludedPredicate struct {
	left  float64
	right float64
}

func (r withinRangeIncludedPredicate) Eval(f float64) bool {
	return f >= r.left && f <= r.right
}

type outsideRangeIncludedPredicate struct {
	left  float64
	right float64
}

func (r outsideRangeIncludedPredicate) Eval(f float64) bool {
	return f <= r.left || f >= r.right
}

type lessThanPredicate struct {
	value float64
}

func (r lessThanPredicate) Eval(f float64) bool {
	return f < r.value
}

type greaterThanPredicate struct {
	value float64
}

func (r greaterThanPredicate) Eval(f float64) bool {
	return f > r.value
}

type equalPredicate struct {
	value float64
}

func (r equalPredicate) Eval(f float64) bool {
	return f == r.value
}

type notEqualPredicate struct {
	value float64
}

func (r notEqualPredicate) Eval(f float64) bool {
	return f != r.value
}

type greaterThanEqualPredicate struct {
	value float64
}

func (r greaterThanEqualPredicate) Eval(f float64) bool {
	return f >= r.value
}

type lessThanEqualPredicate struct {
	value float64
}

func (r lessThanEqualPredicate) Eval(f float64) bool {
	return f <= r.value
}
