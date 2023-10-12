package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type ThresholdCommand struct {
	ReferenceVar  string
	RefID         string
	ThresholdFunc string
	Conditions    []float64
	Invert        bool
}

const (
	ThresholdIsAbove        = "gt"
	ThresholdIsBelow        = "lt"
	ThresholdIsWithinRange  = "within_range"
	ThresholdIsOutsideRange = "outside_range"
)

var (
	supportedThresholdFuncs = []string{ThresholdIsAbove, ThresholdIsBelow, ThresholdIsWithinRange, ThresholdIsOutsideRange}
)

func NewThresholdCommand(refID, referenceVar, thresholdFunc string, conditions []float64) (*ThresholdCommand, error) {
	switch thresholdFunc {
	case ThresholdIsOutsideRange, ThresholdIsWithinRange:
		if len(conditions) < 2 {
			return nil, fmt.Errorf("incorrect number of arguments: got %d but need 2", len(conditions))
		}
	case ThresholdIsAbove, ThresholdIsBelow:
		if len(conditions) < 1 {
			return nil, fmt.Errorf("incorrect number of arguments: got %d but need 1", len(conditions))
		}
	default:
		return nil, fmt.Errorf("expected threshold function to be one of [%s], got %s", strings.Join(supportedThresholdFuncs, ", "), thresholdFunc)
	}

	return &ThresholdCommand{
		RefID:         refID,
		ReferenceVar:  referenceVar,
		ThresholdFunc: thresholdFunc,
		Conditions:    conditions,
	}, nil
}

type ConditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
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
	if firstCondition.UnloadEvaluator != nil && features.IsEnabled(featuremgmt.FlagRecoveryThreshold) {
		unloading, err := NewThresholdCommand(rn.RefID, referenceVar, firstCondition.UnloadEvaluator.Type, firstCondition.UnloadEvaluator.Params)
		unloading.Invert = true
		if err != nil {
			return nil, fmt.Errorf("invalid unloadCondition: %w", err)
		}
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

func (tc *ThresholdCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	mathExpression, err := createMathExpression(tc.ReferenceVar, tc.ThresholdFunc, tc.Conditions, tc.Invert)
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
	case ThresholdIsWithinRange:
		exp = fmt.Sprintf("${%s} > %f && ${%s} < %f", referenceVar, args[0], referenceVar, args[1])
	case ThresholdIsOutsideRange:
		exp = fmt.Sprintf("${%s} < %f || ${%s} > %f", referenceVar, args[0], referenceVar, args[1])
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

type ThresholdCommandConfig struct {
	Expression string                   `json:"expression"`
	Conditions []ThresholdConditionJSON `json:"conditions"`
}

type ThresholdConditionJSON struct {
	Evaluator        ConditionEvalJSON  `json:"evaluator"`
	UnloadEvaluator  *ConditionEvalJSON `json:"unloadEvaluator"`
	LoadedDimensions *data.Frame        `json:"loadedDimensions"`
}
