package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// NumberCompareCondition can compare numbers.
type NumberCompareCondition struct {
	FieldName string
	Op        NumberCompareOp
	Value     float64
}

// NumberCompareOp is an comparison operator.
type NumberCompareOp string

// Known NumberCompareOp types.
const (
	NumberCompareOpLt  NumberCompareOp = "lt"
	NumberCompareOpGt  NumberCompareOp = "gt"
	NumberCompareOpLte NumberCompareOp = "lte"
	NumberCompareOpGte NumberCompareOp = "gte"
	NumberCompareOpEq  NumberCompareOp = "eq"
	NumberCompareOpNe  NumberCompareOp = "ne"
)

const ConditionCheckerTypeNumberCompare = "numberCompare"

func (c *NumberCompareCondition) Type() string {
	return ConditionCheckerTypeNumberCompare
}

func (c *NumberCompareCondition) CheckCondition(_ context.Context, frame *data.Frame) (bool, error) {
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

func NewNumberCompareCondition(fieldName string, op NumberCompareOp, value float64) *NumberCompareCondition {
	return &NumberCompareCondition{FieldName: fieldName, Op: op, Value: value}
}
