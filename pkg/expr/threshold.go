package expr

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

type ThresholdCommand struct {
	ReferenceVar  string
	RefID         string
	ThresholdFunc string
	Conditions    []float64
}

const (
	ThresholdIsAbove = iota
	ThresholdIsBelow
	ThresholdIsWithinRange
	ThresholdIsOutsideRange
)

func NewThresholdCommand(refID string, referenceVar string, thresholdFunc string, conditions []float64) (*ThresholdCommand, error) {
	return &ThresholdCommand{
		RefID:         refID,
		ReferenceVar:  referenceVar,
		ThresholdFunc: thresholdFunc,
		Conditions:    conditions,
	}, nil
}

// UnmarshalResampleCommand creates a ResampleCMD from Grafana's frontend query.
func UnmarshalThresholdCommand(rn *rawNode) (*ThresholdCommand, error) {
	rawVar, ok := rn.Query["expression"]
	if !ok {
		return nil, fmt.Errorf("no variable specified to reference for refId %v", rn.RefID)
	}
	referenceVar, ok := rawVar.(string)
	if !ok {
		return nil, fmt.Errorf("expected threshold variable to be a string, got %T for refId %v", rawVar, rn.RefID)
	}

	rawThresholdFunc, ok := rn.Query["threshold"]
	if !ok {
		return nil, fmt.Errorf("no reference function specified for refId %v", rn.RefID)
	}
	thresholdFunc, ok := rawThresholdFunc.(string)
	if !ok {
		return nil, fmt.Errorf("expected threshold function to be a string, got %T for refId %v", rawVar, rn.RefID)
	}

	if !IsSupportedThresholdFunc(thresholdFunc) {
		supportedThresholdFuncs := GetSupportedThresholdFuncs()
		return nil, fmt.Errorf("expected threshold function to be one of %s, got %s", strings.Join(supportedThresholdFuncs, ", "), thresholdFunc)
	}

	rawConditions, ok := rn.Query["conditions"]
	if !ok {
		return nil, fmt.Errorf("no conditions specified for refId %v", rn.RefID)
	}
	conditions, ok := rawConditions.([]interface{})
	if !ok {
		return nil, fmt.Errorf("expected conditions variable to be a []float64, got %T for refId %v", rawConditions, rn.RefID)
	}

	var conditionFloats []float64
	for _, v := range conditions {
		condition, ok := v.(float64)
		if !ok {
			return nil, fmt.Errorf("expected condition value to be a float64, got %T for refId %v", v, rn.RefID)
		}
		conditionFloats = append(conditionFloats, condition)
	}

	return NewThresholdCommand(rn.RefID, referenceVar, thresholdFunc, conditionFloats)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (tc *ThresholdCommand) NeedsVars() []string {
	return []string{tc.ReferenceVar}
}

func (tc *ThresholdCommand) Execute(ctx context.Context, vars mathexp.Vars) (mathexp.Results, error) {
	mathExpression, err := createMathExpression(tc.ReferenceVar, tc.ThresholdFunc, tc.Conditions)
	if err != nil {
		return mathexp.Results{}, err
	}

	mathCommand, err := NewMathCommand("B", mathExpression)
	if err != nil {
		return mathexp.Results{}, err
	}

	return mathCommand.Execute(ctx, vars)
}

// createMathExpression converts all the info we have about a "threshold" expression in to a Math expression
func createMathExpression(referenceVar string, thresholdFunc string, args []float64) (string, error) {
	switch thresholdFunc {
	case "isAbove":
		return fmt.Sprintf("${%s} > %f", referenceVar, args[0]), nil
	case "isBelow":
		return fmt.Sprintf("${%s} < %f", referenceVar, args[0]), nil
	case "isWithinRange":
		return fmt.Sprintf("${%s} > %f && ${%s} < %f", referenceVar, args[0], referenceVar, args[1]), nil
	case "isOutsideRange":
		return fmt.Sprintf("${%s} < %f || ${%s} > %f", referenceVar, args[0], referenceVar, args[1]), nil
	default:
		return "", fmt.Errorf("failed to evaluate threshold expression: no such threshold function %s", thresholdFunc)
	}
}

// GetSupportedThresholdFuncs returns collection of supported threshold function names
func GetSupportedThresholdFuncs() []string {
	return []string{"isAbove", "isBelow", "isWithinRange", "isOutsideRange"}
}

func IsSupportedThresholdFunc(name string) bool {
	availableThresholdFuncs := GetSupportedThresholdFuncs()
	isSupported := false

	for _, funcName := range availableThresholdFuncs {
		if funcName == name {
			isSupported = true
		}
	}

	return isSupported
}
