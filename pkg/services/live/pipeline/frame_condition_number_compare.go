package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// FrameNumberCompareCondition can compare numbers.
type FrameNumberCompareCondition struct {
	FieldName string
	Op        NumberCompareOp
	Value     float64
}

const FrameConditionCheckerTypeNumberCompare = "numberCompare"

func (c *FrameNumberCompareCondition) Type() string {
	return FrameConditionCheckerTypeNumberCompare
}

func (c *FrameNumberCompareCondition) CheckFrameCondition(_ context.Context, frame *data.Frame) (bool, error) {
	for _, field := range frame.Fields {
		// TODO: support other numeric types.
		if field.Name == c.FieldName && (field.Type() == data.FieldTypeNullableFloat64) {
			value, ok := field.At(0).(*float64)
			if !ok {
				return false, fmt.Errorf("unexpected value type: %T", field.At(0))
			}
			if value == nil {
				return false, nil
			}
			switch c.Op {
			case NumberCompareOpGt:
				return *value > c.Value, nil
			case NumberCompareOpGte:
				return *value >= c.Value, nil
			case NumberCompareOpLte:
				return *value <= c.Value, nil
			case NumberCompareOpLt:
				return *value < c.Value, nil
			case NumberCompareOpEq:
				return *value == c.Value, nil
			case NumberCompareOpNe:
				return *value != c.Value, nil
			default:
				return false, fmt.Errorf("unknown comparison operator: %s", c.Op)
			}
		}
	}
	return false, nil
}

func NewFrameNumberCompareCondition(fieldName string, op NumberCompareOp, value float64) *FrameNumberCompareCondition {
	return &FrameNumberCompareCondition{FieldName: fieldName, Op: op, Value: value}
}
