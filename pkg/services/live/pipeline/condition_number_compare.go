package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type NumberCompareCondition struct {
	FieldName string
	Op        string
	Value     float64
}

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
			case "gt":
				return *value > f.Value, nil
			case "gte":
				return *value >= f.Value, nil
			case "lte":
				return *value <= f.Value, nil
			case "lt":
				return *value < f.Value, nil
			}
		}
	}
	return false, nil
}

func NewNumberCompareCondition(fieldName string, op string, value float64) *NumberCompareCondition {
	return &NumberCompareCondition{FieldName: fieldName, Op: op, Value: value}
}
