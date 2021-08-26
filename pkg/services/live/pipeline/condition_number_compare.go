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

func (f NumberCompareCondition) CheckCondition(_ context.Context, frame *data.Frame) (bool, error) {
	for _, field := range frame.Fields {
		// TODO: support other numeric types.
		if field.Name == f.FieldName && (field.Type() == data.FieldTypeNullableFloat64) {
			value, ok := field.At(0).(*float64)
			if !ok {
				return false, fmt.Errorf("unexpected value type: %T", field.At(0))
			}
			if value == nil {
				return false, nil
			}
			switch f.Op {
			case NumberCompareOpGt:
				return *value > f.Value, nil
			case NumberCompareOpGte:
				return *value >= f.Value, nil
			case NumberCompareOpLte:
				return *value <= f.Value, nil
			case NumberCompareOpLt:
				return *value < f.Value, nil
			case NumberCompareOpEq:
				return *value == f.Value, nil
			case NumberCompareOpNe:
				return *value != f.Value, nil
			default:
				return false, fmt.Errorf("unknown comparison operator: %s", f.Op)
			}
		}
	}
	return false, nil
}

func NewNumberCompareCondition(fieldName string, op NumberCompareOp, value float64) *NumberCompareCondition {
	return &NumberCompareCondition{FieldName: fieldName, Op: op, Value: value}
}
