package expr

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// ErrUnknownExpressionType is returned by ValidateExpressionModel when the
// expression command type cannot be determined from the model JSON.
var ErrUnknownExpressionType = errors.New("unknown expression command type")

// ValidateExpressionModel performs a parse-only validation of an expression
// query model. It is designed to be called from write paths (for example,
// AlertQuery.PreSave) to detect malformed expression models before they land
// in storage. It does not execute the expression and does not depend on
// runtime-only configuration such as memory limits or feature toggles.
//
// Returns:
//   - (nil, nil) when modelRaw is not a recognised expression model
//   - (CommandType, nil) on successful parse
//   - (CommandType, err) when the model is recognised but fails to parse;
//     in this case CommandType may be TypeUnknown if the type itself was invalid
//
// SQL expressions are intentionally skipped because their unmarshaler requires
// a context, cfg, and feature toggles; callers that need SQL validation
// should invoke UnmarshalSQLCommand directly at a later stage.
func ValidateExpressionModel(refID string, modelRaw json.RawMessage) (CommandType, error) {
	if len(modelRaw) == 0 {
		return TypeUnknown, nil
	}

	rawQuery := make(map[string]any)
	if err := json.Unmarshal(modelRaw, &rawQuery); err != nil {
		return TypeUnknown, fmt.Errorf("failed to unmarshal expression model: %w", err)
	}

	commandType, err := GetExpressionCommandType(rawQuery)
	if err != nil {
		return TypeUnknown, fmt.Errorf("%w: %w", ErrUnknownExpressionType, err)
	}

	rn := &rawNode{
		RefID:    refID,
		Query:    rawQuery,
		QueryRaw: modelRaw,
	}

	switch commandType {
	case TypeMath:
		return commandType, validateMathModel(rawQuery)
	case TypeReduce:
		_, err := UnmarshalReduceCommand(rn)
		return commandType, err
	case TypeResample:
		// UnmarshalResampleCommand requires a TimeRange. Supply a zero-value
		// range here so that structural parsing can proceed; the TimeRange is
		// only meaningful at execute time.
		rn.TimeRange = RelativeTimeRange{}
		_, err := UnmarshalResampleCommand(rn)
		return commandType, err
	case TypeClassicConditions:
		_, err := classic.UnmarshalConditionsCmd(rawQuery, refID)
		return commandType, err
	case TypeThreshold:
		_, err := UnmarshalThresholdCommand(rn)
		return commandType, err
	case TypeSQL:
		// SQL validation requires runtime cfg/toggles; skip.
		return commandType, nil
	default:
		return commandType, fmt.Errorf("expression command type %q not supported for pre-save validation", commandType)
	}
}

// validateMathModel reuses the parse step of NewMathCommand without requiring
// a *setting.Cfg. The memory limit from Cfg is an execute-time concern.
func validateMathModel(rawQuery map[string]any) error {
	rawExpr, ok := rawQuery["expression"]
	if !ok {
		return errors.New("command is missing an expression")
	}
	exprString, ok := rawExpr.(string)
	if !ok {
		return fmt.Errorf("math expression is expected to be a string, got %T", rawExpr)
	}
	if _, err := mathexp.New(exprString); err != nil {
		return fmt.Errorf("invalid math command: %w", err)
	}
	return nil
}
