package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type ThresholdCommand struct {
	ReferenceVar  string
	RefID         string
	ThresholdFunc string
	Conditions    []float64
}

const (
	ThresholdIsAbove                = "gt"
	ThresholdIsBelow                = "lt"
	ThresholdIsEqual                = "eq"
	ThresholdIsNotEqual             = "ne"
	ThresholdIsGe                   = "ge"
	ThresholdIsLe                   = "le"
	ThresholdIsWithinRange          = "within_range"
	ThresholdIsOutsideRange         = "outside_range"
	ThresholdIsWithinRangeIncluded  = "within_range_included"
	ThresholdIsOutsideRangeIncluded = "outside_range_included"
)

var (
	supportedThresholdFuncs = []string{
		ThresholdIsAbove,
		ThresholdIsBelow,
		ThresholdIsEqual,
		ThresholdIsNotEqual,
		ThresholdIsGe,
		ThresholdIsLe,
		ThresholdIsWithinRange,
		ThresholdIsOutsideRange,
		ThresholdIsWithinRangeIncluded,
		ThresholdIsOutsideRangeIncluded,
	}
)

func NewThresholdCommand(refID, referenceVar, thresholdFunc string, conditions []float64) (*ThresholdCommand, error) {
	switch thresholdFunc {
	case ThresholdIsOutsideRange, ThresholdIsWithinRange, ThresholdIsWithinRangeIncluded, ThresholdIsOutsideRangeIncluded:
		if len(conditions) < 2 {
			return nil, fmt.Errorf("incorrect number of arguments: got %d but need 2", len(conditions))
		}
	case ThresholdIsAbove, ThresholdIsBelow, ThresholdIsEqual, ThresholdIsNotEqual, ThresholdIsGe, ThresholdIsLe:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments: got %d but need 1", len(conditions))
		}
	}

	return &ThresholdCommand{
		RefID:         refID,
		ReferenceVar:  referenceVar,
		ThresholdFunc: thresholdFunc,
		Conditions:    conditions,
	}, nil
}

type ThresholdConditionJSON struct {
	Evaluator ConditionEvalJSON `json:"evaluator"`
}

type ConditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
}

// UnmarshalResampleCommand creates a ResampleCMD from Grafana's frontend query.
func UnmarshalThresholdCommand(rn *rawNode) (*ThresholdCommand, error) {
	rawQuery := rn.Query

	rawExpression, ok := rawQuery["expression"]
	if !ok {
		return nil, fmt.Errorf("no variable specified to reference for refId %v", rn.RefID)
	}
	referenceVar, ok := rawExpression.(string)
	if !ok {
		return nil, fmt.Errorf("expected threshold variable to be a string, got %T for refId %v", rawExpression, rn.RefID)
	}

	jsonFromM, err := json.Marshal(rawQuery["conditions"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal threshold expression body: %w", err)
	}
	var conditions []ThresholdConditionJSON
	if err = json.Unmarshal(jsonFromM, &conditions); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled threshold expression body: %w", err)
	}

	for _, condition := range conditions {
		if !IsSupportedThresholdFunc(condition.Evaluator.Type) {
			return nil, fmt.Errorf("expected threshold function to be one of %s, got %s", strings.Join(supportedThresholdFuncs, ", "), condition.Evaluator.Type)
		}
	}

	// we only support one condition for now, we might want to turn this in to "OR" expressions later
	if len(conditions) != 1 {
		return nil, fmt.Errorf("threshold expression requires exactly one condition")
	}
	firstCondition := conditions[0]

	return NewThresholdCommand(rn.RefID, referenceVar, firstCondition.Evaluator.Type, firstCondition.Evaluator.Params)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (tc *ThresholdCommand) NeedsVars() []string {
	return []string{tc.ReferenceVar}
}

func (tc *ThresholdCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	mathExpression, err := createMathExpression(tc.ReferenceVar, tc.ThresholdFunc, tc.Conditions)
	if err != nil {
		return mathexp.Results{}, err
	}

	mathCommand, err := NewMathCommand(tc.ReferenceVar, mathExpression)
	if err != nil {
		return mathexp.Results{}, err
	}

	return mathCommand.Execute(ctx, now, vars, tracer)
}

// createMathExpression converts all the info we have about a "threshold" expression in to a Math expression
func createMathExpression(referenceVar string, thresholdFunc string, args []float64, invert bool) (string, error) {
	var exp string
	switch thresholdFunc {
	case ThresholdIsAbove:
		exp = fmt.Sprintf("${%s} > %f", referenceVar, args[0])
	case ThresholdIsBelow:
		exp = fmt.Sprintf("${%s} < %f", referenceVar, args[0])
	case ThresholdIsEqual:
		exp = fmt.Sprintf("${%s} == %f", referenceVar, args[0])
	case ThresholdIsNotEqual:
		exp = fmt.Sprintf("${%s} != %f", referenceVar, args[0])
	case ThresholdIsGe:
		exp = fmt.Sprintf("${%s} >= %f", referenceVar, args[0])
	case ThresholdIsLe:
		exp = fmt.Sprintf("${%s} <= %f", referenceVar, args[0])
	case ThresholdIsWithinRange:
		exp = fmt.Sprintf("${%s} > %f && ${%s} < %f", referenceVar, args[0], referenceVar, args[1])
	case ThresholdIsWithinRangeIncluded:
		exp = fmt.Sprintf("${%s} >= %f && ${%s} <= %f", referenceVar, args[0], referenceVar, args[1])
	case ThresholdIsOutsideRange:
		exp = fmt.Sprintf("${%s} < %f || ${%s} > %f", referenceVar, args[0], referenceVar, args[1])
	case ThresholdIsOutsideRangeIncluded:
		exp = fmt.Sprintf("${%s} <= %f || ${%s} >= %f", referenceVar, args[0], referenceVar, args[1])
	default:
		return "", fmt.Errorf("failed to evaluate threshold expression: no such threshold function %s", thresholdFunc)
	}

	if invert {
		return fmt.Sprintf("!(%s)", exp), nil
	}
	return exp, nil
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
