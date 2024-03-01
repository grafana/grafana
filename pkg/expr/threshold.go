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
)

type ThresholdCommand struct {
	ReferenceVar  string
	RefID         string
	ThresholdFunc ThresholdType
	Conditions    []float64
	Invert        bool
}

// +enum
type ThresholdType string

const (
	ThresholdIsAbove        ThresholdType = "gt"
	ThresholdIsBelow        ThresholdType = "lt"
	ThresholdIsWithinRange  ThresholdType = "within_range"
	ThresholdIsOutsideRange ThresholdType = "outside_range"
)

var (
	supportedThresholdFuncs = []string{
		string(ThresholdIsAbove),
		string(ThresholdIsBelow),
		string(ThresholdIsWithinRange),
		string(ThresholdIsOutsideRange),
	}
)

func NewThresholdCommand(refID, referenceVar string, thresholdFunc ThresholdType, conditions []float64) (*ThresholdCommand, error) {
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
func createMathExpression(referenceVar string, thresholdFunc ThresholdType, args []float64, invert bool) (string, error) {
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
